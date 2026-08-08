import fs from 'node:fs'
import path from 'node:path'
import type { BrowserContext, Page } from 'playwright'
import { resolveTarget, resolved } from './resolve'
import { repairStep } from './repair'
import { describeStep, maskValue, type Step } from './steps'
import type { StepStatus } from '@/lib/db/types'

export interface StepOutcome {
  idx: number
  action: string
  description: string
  status: StepStatus
  detail: string | null
  selectorUsed: string | null
  url: string | null
  durationMs: number
  screenshotFile: string | null
  consoleErrors: string[]
  /** Set when AI repair supplied the selector, so it can be written back. */
  learnedSelector?: string
}

export interface ExecuteOptions {
  steps: Step[]
  baseUrl: string
  screenshotDir: string
  onStep: (outcome: StepOutcome) => void
  onProgress: (current: number, total: number, message: string) => void
  signal?: AbortSignal
  /** Skip the AI repair path entirely — used to prove a run is deterministic. */
  noRepair?: boolean
  /** Pause after each step, in ms. Defaults to DEFAULT_STEP_PAUSE_MS. */
  stepPauseMs?: number
}

export interface ExecuteResult {
  outcomes: StepOutcome[]
  repairs: number
  failed: boolean
}

/** Default pause after each step, so the page has time to settle before the next action. */
export const DEFAULT_STEP_PAUSE_MS = 1000

/**
 * Runs compiled steps in order against one browser context. A failure stops the
 * run and marks the remainder skipped: continuing past a failed login would
 * produce a cascade of misleading errors rather than one clear cause.
 */
export async function executeSteps(
  context: BrowserContext,
  opts: ExecuteOptions,
): Promise<ExecuteResult> {
  fs.mkdirSync(opts.screenshotDir, { recursive: true })

  const stepPauseMs = opts.stepPauseMs ?? DEFAULT_STEP_PAUSE_MS
  const outcomes: StepOutcome[] = []
  let repairs = 0
  let failed = false

  const page = await context.newPage()
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300))
  })
  page.on('pageerror', (err) => consoleErrors.push(`Uncaught ${err.message}`.slice(0, 300)))
  page.on('dialog', (d) => d.accept().catch(() => {}))

  try {
    for (let i = 0; i < opts.steps.length; i++) {
      const step = opts.steps[i]

      if (failed || opts.signal?.aborted) {
        const skipped: StepOutcome = {
          idx: i,
          action: step.action,
          description: step.description || describeStep(step),
          status: 'skipped',
          detail: opts.signal?.aborted ? 'Run cancelled.' : 'Skipped after an earlier failure.',
          selectorUsed: null,
          url: null,
          durationMs: 0,
          screenshotFile: null,
          consoleErrors: [],
        }
        outcomes.push(skipped)
        opts.onStep(skipped)
        continue
      }

      opts.onProgress(i + 1, opts.steps.length, describeStep(step))
      consoleErrors.length = 0

      const started = Date.now()
      const outcome = await runStep(page, step, i, opts)
      outcome.durationMs = Date.now() - started
      outcome.consoleErrors = consoleErrors.slice(0, 10)
      outcome.url = safeUrl(page)

      if (outcome.status === 'repaired') repairs++
      if (outcome.status === 'failed') failed = true

      outcomes.push(outcome)
      opts.onStep(outcome)

      await page.waitForTimeout(stepPauseMs)
    }
  } finally {
    await page.close().catch(() => {})
  }

  return { outcomes, repairs, failed }
}

async function runStep(
  page: Page,
  step: Step,
  idx: number,
  opts: ExecuteOptions,
): Promise<StepOutcome> {
  const outcome: StepOutcome = {
    idx,
    action: step.action,
    description: step.description || describeStep(step),
    status: 'passed',
    detail: null,
    selectorUsed: null,
    url: null,
    durationMs: 0,
    screenshotFile: null,
    consoleErrors: [],
  }

  try {
    switch (step.action) {
      case 'goto': {
        const url = new URL(step.url, opts.baseUrl).toString()
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await settle(page)
        outcome.detail = `Loaded ${url}`
        break
      }

      case 'click':
      case 'fill':
      case 'select': {
        const found = await locate(page, step, step.target, step.action, opts, outcome)
        if (!found) return outcome

        if (step.action === 'click') {
          await found.click({ timeout: 8000 })
          await settle(page)
          outcome.detail = `Clicked "${step.target}"`
        } else if (step.action === 'fill') {
          await found.fill(step.value, { timeout: 8000 })
          outcome.detail = `Filled "${step.target}" with ${maskValue(step)}`
        } else {
          await found.selectOption(step.value, { timeout: 8000 })
          outcome.detail = `Selected "${step.value}" in "${step.target}"`
        }
        break
      }

      case 'press': {
        await page.keyboard.press(step.key)
        await settle(page)
        outcome.detail = `Pressed ${step.key}`
        break
      }

      case 'waitFor': {
        if (step.text) {
          await page.getByText(step.text).first().waitFor({ state: 'visible', timeout: 15_000 })
          outcome.detail = `"${step.text}" appeared`
        } else {
          await page.waitForTimeout(step.ms ?? 1000)
          outcome.detail = `Waited ${step.ms ?? 1000}ms`
        }
        break
      }

      case 'assertText': {
        const present = await pageContainsText(page, step.text)
        if (step.absent && present) {
          throw new AssertionError(`"${step.text}" is still on the page but should be gone.`)
        }
        if (!step.absent && !present) {
          throw new AssertionError(`"${step.text}" was not found on the page.`)
        }
        outcome.detail = step.absent
          ? `"${step.text}" is absent, as expected`
          : `Found "${step.text}"`
        break
      }

      case 'assertUrl': {
        const current = page.url()
        if (!current.includes(step.contains)) {
          throw new AssertionError(`URL is ${current}, which does not contain "${step.contains}".`)
        }
        outcome.detail = `URL contains "${step.contains}"`
        break
      }

      case 'screenshot': {
        outcome.detail = step.label || 'Screenshot captured'
        break
      }
    }
  } catch (err) {
    outcome.status = 'failed'
    outcome.detail =
      err instanceof AssertionError
        ? err.message
        : `${(err as Error).message.split('\n')[0]}`.slice(0, 300)
  }

  outcome.screenshotFile = await capture(page, opts.screenshotDir, idx)
  return outcome
}

/**
 * Deterministic resolution first; the model is consulted only when every rung
 * of the ladder misses. A repaired step records the selector so the next run
 * skips the AI entirely.
 */
async function locate(
  page: Page,
  step: Step,
  target: string,
  intent: 'click' | 'fill' | 'select',
  opts: ExecuteOptions,
  outcome: StepOutcome,
) {
  const hint = 'selector' in step ? step.selector : undefined
  const result = await resolveTarget(page, target, hint, intent)

  if (resolved(result)) {
    outcome.selectorUsed = `${result.selector} (${result.strategy})`
    return result.locator
  }

  if (opts.noRepair) {
    outcome.status = 'failed'
    outcome.detail = `Could not find "${target}". Tried: ${result.attempted.join(', ')}.`
    outcome.screenshotFile = await capture(page, opts.screenshotDir, outcome.idx)
    return null
  }

  const repair = await repairStep(page, step, target, opts.signal)
  if (!repair.selector) {
    outcome.status = 'failed'
    outcome.detail =
      `Could not find "${target}". Tried: ${result.attempted.join(', ')}.` +
      (repair.reason ? ` AI repair: ${repair.reason}` : '')
    outcome.screenshotFile = await capture(page, opts.screenshotDir, outcome.idx)
    return null
  }

  const repaired = page.locator(repair.selector).first()
  if (!(await repaired.count().catch(() => 0))) {
    outcome.status = 'failed'
    outcome.detail = `Could not find "${target}". AI suggested ${repair.selector}, which also matched nothing.`
    outcome.screenshotFile = await capture(page, opts.screenshotDir, outcome.idx)
    return null
  }

  outcome.status = 'repaired'
  outcome.selectorUsed = `${repair.selector} (AI repair)`
  outcome.learnedSelector = repair.selector
  outcome.detail = repair.reason ? `Selector repaired by AI: ${repair.reason}` : 'Selector repaired by AI'
  return repaired
}

class AssertionError extends Error {}

/**
 * `body.textContent` only ever sees rendered text nodes — a value typed into
 * an `<input>` or `<textarea>`, or the selected option of a `<select>`, is a
 * DOM property, not text content, so it never shows up there even though it
 * is right there on screen. A saved form field is exactly the kind of thing
 * assertText is used to check, so this also reads those values directly.
 */
async function pageContainsText(page: Page, text: string): Promise<boolean> {
  const haystack = await page
    .evaluate(() => {
      const body = document.body.innerText || document.body.textContent || ''
      const fieldValues = Array.from(document.querySelectorAll('input, textarea')).map(
        (el) => (el as HTMLInputElement | HTMLTextAreaElement).value || '',
      )
      const selected = Array.from(document.querySelectorAll('select')).map(
        (el) => (el as HTMLSelectElement).selectedOptions[0]?.text || '',
      )
      return [body, ...fieldValues, ...selected].join('\n')
    })
    .catch(() => '')

  return haystack.toLowerCase().includes(text.toLowerCase())
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(250)
}

async function capture(page: Page, dir: string, idx: number): Promise<string | null> {
  const file = `step-${String(idx).padStart(3, '0')}.jpg`
  try {
    await page.screenshot({ path: path.join(dir, file), type: 'jpeg', quality: 60 })
    return file
  } catch {
    return null
  }
}

function safeUrl(page: Page): string | null {
  try {
    return page.url()
  } catch {
    return null
  }
}
