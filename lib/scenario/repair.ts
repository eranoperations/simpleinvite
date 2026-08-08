import type { Page } from 'playwright'
import { complete, parseJsonResponse } from '@/lib/ai/client'
import { isAiConfigured } from '@/lib/ai/config'
import { evalInPage } from '@/lib/crawl/browser'
import { EXTRACT_SCRIPT, type PageExtract } from '@/lib/crawl/extract'
import { describeLiveElements } from './inventory'
import type { Step } from './steps'

const SYSTEM = `A website test step could not find its element. You are given the step and a list of
every interactive element actually present on the page right now, each with a CSS selector.

Reply with ONLY a JSON object: {"selector":"<css selector from the list>","reason":"<short>"}

Pick the selector of the element the step is trying to act on. If no element on the page could
plausibly be the one, reply {"selector":null,"reason":"<why>"}. Never invent a selector that is
not in the list.`

export interface RepairResult {
  selector: string | null
  reason: string
}

/**
 * The single AI call in an otherwise deterministic run, made only when the
 * resolver ladder came up empty. On success the selector is written back into
 * the scenario, so the same run replays without AI next time.
 *
 * The step's value is never sent — a password has no bearing on which element
 * to click, and there is no reason to hand it to a third party.
 */
export async function repairStep(
  page: Page,
  step: Step,
  target: string,
  signal?: AbortSignal,
): Promise<RepairResult> {
  if (!isAiConfigured()) {
    return { selector: null, reason: 'No AI provider configured, so no repair was attempted.' }
  }

  let inventory = ''
  try {
    const extract = await evalInPage<PageExtract>(page, EXTRACT_SCRIPT)
    inventory = describeLiveElements(extract.interactive, extract.forms)
    // Anchors are absent from `interactive` by design, but a step may well be
    // trying to click one.
    const links = extract.links
      .slice(0, 40)
      .map((l) => `LINK "${l.text}" -> ${l.href} — selector: ${l.selector}`)
      .join('\n')
    inventory = [inventory, links].filter(Boolean).join('\n')
  } catch {
    return { selector: null, reason: 'Could not read the page to attempt a repair.' }
  }

  if (!inventory.trim()) {
    return { selector: null, reason: 'The page exposed no interactive elements to match against.' }
  }

  const prompt = [
    `STEP: ${step.action} on element described as "${target}"`,
    `PAGE URL: ${page.url()}`,
    `ELEMENTS ON THE PAGE:\n${inventory}`,
  ].join('\n\n')

  try {
    const raw = await complete([{ role: 'user', content: prompt }], {
      system: SYSTEM,
      temperature: 0,
      maxTokens: 500,
      signal,
    })
    const parsed = parseJsonResponse<{ selector?: string | null; reason?: string }>(raw)
    const selector = typeof parsed.selector === 'string' ? parsed.selector.trim() : null

    return {
      selector: selector || null,
      reason: parsed.reason?.slice(0, 200) ?? '',
    }
  } catch (err) {
    return { selector: null, reason: `Repair call failed: ${(err as Error).message.slice(0, 150)}` }
  }
}
