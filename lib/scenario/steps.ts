import { z } from 'zod'

/**
 * Compiled steps arrive from a language model, so this schema is a trust
 * boundary rather than a convenience: the executor only ever sees shapes that
 * survived it. Actions are deliberately narrow — there is no "evaluate
 * arbitrary JavaScript" step, because nothing in a test scenario needs one and
 * it would turn a prompt injection on the target site into code execution.
 */

const base = {
  /** The sentence this step came from, shown verbatim in the run timeline. */
  description: z.string().max(400).default(''),
}

export const StepSchema = z.discriminatedUnion('action', [
  z.object({
    ...base,
    action: z.literal('goto'),
    url: z.string().max(2000),
  }),
  z.object({
    ...base,
    action: z.literal('click'),
    target: z.string().min(1).max(300),
    selector: z.string().max(500).optional(),
  }),
  z.object({
    ...base,
    action: z.literal('fill'),
    target: z.string().min(1).max(300),
    value: z.string().max(2000),
    selector: z.string().max(500).optional(),
    /** Marks a value to mask in the UI and logs. */
    secret: z.boolean().optional(),
  }),
  z.object({
    ...base,
    action: z.literal('select'),
    target: z.string().min(1).max(300),
    value: z.string().max(500),
    selector: z.string().max(500).optional(),
  }),
  z.object({
    ...base,
    action: z.literal('press'),
    key: z.string().min(1).max(40),
  }),
  z.object({
    ...base,
    action: z.literal('waitFor'),
    text: z.string().max(300).optional(),
    ms: z.number().int().min(0).max(30_000).optional(),
  }),
  z.object({
    ...base,
    action: z.literal('assertText'),
    text: z.string().min(1).max(300),
    absent: z.boolean().optional(),
  }),
  z.object({
    ...base,
    action: z.literal('assertUrl'),
    contains: z.string().min(1).max(500),
  }),
  z.object({
    ...base,
    action: z.literal('screenshot'),
    label: z.string().max(120).default(''),
  }),
])

export type Step = z.infer<typeof StepSchema>
export type StepAction = Step['action']

export const StepsSchema = z.array(StepSchema).min(1).max(60)

/** A step's target description, for the actions that address an element. */
export function stepTarget(step: Step): string | null {
  return 'target' in step ? step.target : null
}

export function stepSelector(step: Step): string | undefined {
  return 'selector' in step ? step.selector : undefined
}

/** Never let a password reach a log line, a step detail, or the AI repair prompt. */
export function maskValue(step: Step): string {
  if (step.action !== 'fill') return ''
  return step.secret ? '••••••••' : step.value
}

export function describeStep(step: Step): string {
  switch (step.action) {
    case 'goto':
      return `Go to ${step.url}`
    case 'click':
      return `Click "${step.target}"`
    case 'fill':
      return `Fill "${step.target}" with ${maskValue(step)}`
    case 'select':
      return `Select "${step.value}" in "${step.target}"`
    case 'press':
      return `Press ${step.key}`
    case 'waitFor':
      return step.text ? `Wait for "${step.text}"` : `Wait ${step.ms ?? 1000}ms`
    case 'assertText':
      return step.absent ? `Expect "${step.text}" to be absent` : `Expect to see "${step.text}"`
    case 'assertUrl':
      return `Expect URL to contain "${step.contains}"`
    case 'screenshot':
      return step.label ? `Screenshot: ${step.label}` : 'Screenshot'
  }
}

export function parseSteps(value: unknown): Step[] {
  return StepsSchema.parse(value)
}

export function parseStepsJson(json: string | null): Step[] | null {
  if (!json) return null
  try {
    return parseSteps(JSON.parse(json))
  } catch {
    return null
  }
}
