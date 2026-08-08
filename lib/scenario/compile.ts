import { complete, parseJsonResponse } from '@/lib/ai/client'
import { parseSteps, type Step } from './steps'
import { buildInventory } from './inventory'

const SYSTEM = `You convert a plain-English website test scenario into a strict JSON array of steps.

Return ONLY a JSON array. No prose, no markdown fence, no explanation.

Each element is an object whose "action" is one of:

  {"action":"goto","url":"<absolute url>","description":"..."}
  {"action":"click","target":"<what the user would call the element>","description":"..."}
  {"action":"fill","target":"<the field>","value":"<text to type>","secret":<true for passwords>,"description":"..."}
  {"action":"select","target":"<the dropdown>","value":"<option>","description":"..."}
  {"action":"press","key":"<Enter|Tab|Escape|...>","description":"..."}
  {"action":"waitFor","text":"<text to appear>","description":"..."}
  {"action":"waitFor","ms":<milliseconds>,"description":"..."}
  {"action":"assertText","text":"<text expected on the page>","absent":<true to expect it gone>,"description":"..."}
  {"action":"assertUrl","contains":"<substring of the expected url>","description":"..."}
  {"action":"screenshot","label":"<short label>","description":"..."}

Rules:
- "description" restates the user's own sentence for that step. Keep their wording.
- "target" describes the element the way a person would ("Email", "Sign in", "Account name").
  Do NOT invent CSS selectors — the runner resolves targets against the live page.
- Use the SITE INVENTORY to pick real URLs and real field names. If the inventory shows a
  login form at a given URL, "go to the login page" must become a goto with that exact URL.
- Mark any password, token or secret value with "secret": true.
- After an action that should change something, add an assertText or assertUrl that proves it
  worked. A scenario with no assertions cannot fail meaningfully.
- Submitting a form is a "click" on its submit button, followed by a waitFor or assert.
- Prefer few, meaningful steps over many trivial ones. Never exceed 60 steps.`

export interface CompileInput {
  sourceText: string
  targetUrl: string
  mapId?: string | null
  signal?: AbortSignal
}

export async function compileScenario(input: CompileInput): Promise<Step[]> {
  const inventory = input.mapId ? buildInventory(input.mapId) : ''

  const parts = [
    `TARGET SITE: ${input.targetUrl}`,
    inventory
      ? `SITE INVENTORY (pages, forms and buttons found by the mapper):\n\n${inventory}`
      : 'SITE INVENTORY: none available — this site has not been mapped yet. Use your best judgement for URLs and field names.',
    `SCENARIO:\n${input.sourceText}`,
  ]

  const raw = await complete([{ role: 'user', content: parts.join('\n\n---\n\n') }], {
    system: SYSTEM,
    temperature: 0,
    signal: input.signal,
  })

  const parsed = parseJsonResponse<unknown>(raw)
  // An array is what the prompt asks for, but models sometimes wrap it in an
  // object; accept the common shapes rather than failing the whole compile.
  const array = Array.isArray(parsed)
    ? parsed
    : ((parsed as Record<string, unknown>)?.steps ?? (parsed as Record<string, unknown>)?.actions)

  return parseSteps(array)
}
