import fs from 'node:fs'
import path from 'node:path'
import { complete, parseJsonResponse, type ChatMessage, type ContentPart } from '@/lib/ai/client'
import { isAiConfigured, AiNotConfiguredError } from '@/lib/ai/config'
import { maskValue, type Step } from './steps'

export interface RunStepSummary {
  idx: number
  action: string
  description: string
  status: string
  detail: string | null
  selectorUsed: string | null
  url: string | null
  consoleErrors: string[]
  screenshotFile: string | null
}

export interface DiagnoseInput {
  sourceText: string
  targetUrl: string
  steps: Step[]
  runSteps: RunStepSummary[]
  /** Where this run's screenshots live on disk — lets the model see the failing page, not just read about it. */
  screenshotDir: string
  signal?: AbortSignal
}

export type DiagnosisCategory = 'steps' | 'website' | 'unclear'

export interface DiagnoseResult {
  category: DiagnosisCategory
  diagnosis: string
  suggestion: string
  /**
   * A rewritten plain-English scenario, only when confidently fixable — null otherwise.
   * The compiled steps are never patched directly: the text stays the one source of
   * truth, and applying a fix means recompiling it through the normal pipeline, so a
   * later hand-edit of the text can never silently discard a fix nobody can see.
   */
  fixedSourceText: string | null
  /** Whether the failing page's screenshot(s) were actually sent to the model. */
  usedScreenshots: boolean
}

const SYSTEM = `A compiled browser test failed partway through. You are given the scenario exactly as a
person described it in plain English, the steps that were compiled from that description, the run log of
what actually happened at each step, and — when available — a screenshot of the page right before the
failure and right at the moment of failure.

Decide which case this is:

- "steps": rewriting the scenario's plain-English description would fix this. Common causes: the
  description never mentioned navigating to a page a later sentence assumes it is already on (check the
  "url" recorded at each step — if a fill or click happens on the wrong page, a "go to ..." sentence is
  probably missing), the wording was ambiguous enough that it compiled to the wrong step, or the element
  appears later than the test allows and a sentence like "wait a second before clicking X" would help.
  In this case return the FULL rewritten scenario text — in the user's own voice and style, changing only
  what is necessary to fix the problem. Never invent behavior the user did not ask for.

- "website": the description is already a faithful, reasonable test and the live site simply does not
  have what it describes — the resolver and AI repair both looked at the real page and found nothing
  plausible (the run log and any screenshot say so), a screenshot shows the page is clearly wrong, or a
  console error points at a broken page. Rewriting the scenario would not fix a real site problem. Leave
  fixedSourceText null.

- "unclear": there is not enough information in the log or screenshot to tell.

Use the screenshots as evidence, not decoration: if the "before" screenshot already shows the described
element on screen, resolution genuinely failed and rewriting the text is unlikely to help; if the element
is visibly absent, greyed out, or the page is clearly the wrong one, say so concretely in the diagnosis.

Reply with ONLY a JSON object:
{"category":"steps"|"website"|"unclear","diagnosis":"<2-3 sentences on what actually went wrong>","suggestion":"<concrete next step for a human: rewrite part of the scenario, check the site for a bug, add a wait, etc>","fixedSourceText": "<full rewritten scenario text>" or null}`

/**
 * Fixing a scenario needs no LIVE browser — the run already recorded every
 * step's outcome, including the reason AI repair gave up when it tried (it
 * looked at the real page and found nothing plausible), and a screenshot of
 * the page at the moment of failure. That is enough for a second model call
 * to tell "the scenario's own wording is wrong" apart from "the site doesn't
 * have what the scenario describes".
 */
export async function diagnoseRun(input: DiagnoseInput): Promise<DiagnoseResult> {
  if (!isAiConfigured()) throw new AiNotConfiguredError()

  const promptText = [
    `TARGET SITE: ${input.targetUrl}`,
    `SCENARIO, IN THE USER'S OWN WORDS:\n${input.sourceText}`,
    `COMPILED STEPS (what this description actually turned into):\n${JSON.stringify(redactSecrets(input.steps), null, 2)}`,
    `RUN LOG (in order):\n${describeRunLog(input.runSteps)}`,
  ].join('\n\n---\n\n')

  const images = loadFailureScreenshots(input.runSteps, input.screenshotDir)
  const message: ChatMessage = images.length
    ? {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          ...images.flatMap((img): ContentPart[] => [
            { type: 'text', text: `Screenshot — ${img.label}:` },
            { type: 'image', mediaType: 'image/jpeg', data: img.base64 },
          ]),
        ],
      }
    : { role: 'user', content: promptText }

  let raw: string
  let usedScreenshots = images.length > 0
  try {
    raw = await complete([message], {
      system: SYSTEM,
      temperature: 0,
      maxTokens: 2000,
      signal: input.signal,
    })
  } catch (err) {
    // Not every configured model accepts image input — fall back to a
    // text-only call rather than losing the diagnosis entirely.
    if (!usedScreenshots) throw err
    usedScreenshots = false
    raw = await complete([{ role: 'user', content: promptText }], {
      system: SYSTEM,
      temperature: 0,
      maxTokens: 2000,
      signal: input.signal,
    })
  }

  const parsed = parseJsonResponse<{
    category?: string
    diagnosis?: string
    suggestion?: string
    fixedSourceText?: unknown
  }>(raw)

  const category: DiagnosisCategory =
    parsed.category === 'steps' || parsed.category === 'website' ? parsed.category : 'unclear'

  const fixedSourceText =
    typeof parsed.fixedSourceText === 'string' && parsed.fixedSourceText.trim()
      ? parsed.fixedSourceText.trim().slice(0, 20_000)
      : null

  return {
    category,
    diagnosis: (parsed.diagnosis ?? 'Could not determine what went wrong.').slice(0, 800),
    suggestion: (parsed.suggestion ?? '').slice(0, 800),
    fixedSourceText,
    usedScreenshots,
  }
}

/** The step right before the failure, and the failure itself — showing the transition is more useful than either alone. */
function loadFailureScreenshots(
  runSteps: RunStepSummary[],
  screenshotDir: string,
): { label: string; base64: string }[] {
  const failedIdx = runSteps.findIndex((s) => s.status === 'failed')
  if (failedIdx === -1) return []

  const candidates = [
    { step: runSteps[failedIdx - 1], label: 'the step just before the failure' },
    { step: runSteps[failedIdx], label: 'the moment of failure' },
  ]

  const images: { label: string; base64: string }[] = []
  for (const { step, label } of candidates) {
    if (!step?.screenshotFile) continue
    try {
      const data = fs.readFileSync(path.join(screenshotDir, step.screenshotFile))
      images.push({ label: `${label} (step ${step.idx + 1})`, base64: data.toString('base64') })
    } catch {
      // A missing or unreadable screenshot just means one less image — not a failure.
    }
  }
  return images
}

function describeRunLog(runSteps: RunStepSummary[]): string {
  return runSteps
    .map((s) => {
      const lines = [`${s.idx + 1}. [${s.status}] ${s.action} — ${s.description}`]
      if (s.url) lines.push(`   page at this point: ${s.url}`)
      if (s.detail) lines.push(`   detail: ${s.detail}`)
      if (s.selectorUsed) lines.push(`   resolved via: ${s.selectorUsed}`)
      for (const err of s.consoleErrors) lines.push(`   console error: ${err}`)
      return lines.join('\n')
    })
    .join('\n')
}

/** The model needs to see step *shape*, not the password — it never has to know the value to judge ordering or wording. */
function redactSecrets(steps: Step[]): unknown[] {
  return steps.map((step) =>
    step.action === 'fill' && step.secret ? { ...step, value: maskValue(step) } : step,
  )
}
