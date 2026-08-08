import type { Locator, Page } from 'playwright'

export interface ResolveOutcome {
  locator: Locator
  /** How it was found — surfaced in the run timeline so a failure is diagnosable. */
  strategy: string
  selector: string
}

export interface ResolveFailure {
  locator?: never
  attempted: string[]
}

export type ResolveResult = ResolveOutcome | ResolveFailure

export function resolved(result: ResolveResult): result is ResolveOutcome {
  return 'locator' in result && result.locator !== undefined
}

type Candidate = { strategy: string; selector: string; build: () => Locator }

/**
 * Turns a human description ("Sign in", "Account name") into a Playwright
 * locator without asking a model. The ladder runs cheapest-and-most-stable
 * first, and the first strategy that matches exactly one visible element wins.
 *
 * This is why a compiled scenario replays for free: AI is only consulted when
 * every rung below fails.
 */
export async function resolveTarget(
  page: Page,
  target: string,
  hint: string | undefined,
  intent: 'click' | 'fill' | 'select',
): Promise<ResolveResult> {
  const attempted: string[] = []
  const name = target.trim()

  const candidates: Candidate[] = []

  // A selector learned from a previous run or a repair always goes first.
  if (hint) {
    candidates.push({
      strategy: 'compiled selector',
      selector: hint,
      build: () => page.locator(hint),
    })
  }

  candidates.push({
    strategy: 'test id',
    selector: `[data-testid="${name}"]`,
    build: () => page.getByTestId(name),
  })

  if (intent === 'fill' || intent === 'select') {
    candidates.push(
      { strategy: 'label', selector: `label=${name}`, build: () => page.getByLabel(name, { exact: true }) },
      { strategy: 'label (loose)', selector: `label~=${name}`, build: () => page.getByLabel(name) },
      {
        strategy: 'placeholder',
        selector: `placeholder=${name}`,
        build: () => page.getByPlaceholder(name),
      },
      { strategy: 'name attribute', selector: `[name="${name}"]`, build: () => page.locator(`[name="${cssEscape(name)}"]`) },
      {
        strategy: 'name attribute (slug)',
        selector: `[name="${slug(name)}"]`,
        build: () => page.locator(`[name="${cssEscape(slug(name))}"]`),
      },
      { strategy: 'id', selector: `#${slug(name)}`, build: () => page.locator(`#${cssEscape(slug(name))}`) },
    )
  }

  if (intent === 'click') {
    candidates.push(
      {
        strategy: 'role=button',
        selector: `role=button[name="${name}"]`,
        build: () => page.getByRole('button', { name, exact: true }),
      },
      {
        strategy: 'role=link',
        selector: `role=link[name="${name}"]`,
        build: () => page.getByRole('link', { name, exact: true }),
      },
      {
        strategy: 'role=button (loose)',
        selector: `role=button~="${name}"`,
        build: () => page.getByRole('button', { name }),
      },
      {
        strategy: 'role=link (loose)',
        selector: `role=link~="${name}"`,
        build: () => page.getByRole('link', { name }),
      },
      {
        strategy: 'submit value',
        selector: `input[type=submit][value="${name}"]`,
        build: () => page.locator(`input[type="submit"][value="${cssEscape(name)}"]`),
      },
    )
  }

  candidates.push(
    { strategy: 'aria-label', selector: `[aria-label="${name}"]`, build: () => page.locator(`[aria-label="${cssEscape(name)}"]`) },
    { strategy: 'exact text', selector: `text="${name}"`, build: () => page.getByText(name, { exact: true }) },
    { strategy: 'partial text', selector: `text~="${name}"`, build: () => page.getByText(name) },
  )

  // A description that is already a CSS selector should be honored as one.
  if (/^[#.\[]|^[a-z]+[#.\[>]/i.test(name)) {
    candidates.push({ strategy: 'literal selector', selector: name, build: () => page.locator(name) })
  }

  for (const candidate of candidates) {
    attempted.push(candidate.strategy)
    try {
      const locator = candidate.build()
      const count = await locator.count()
      if (count === 0) continue

      // Several matches usually means the description was ambiguous; take the
      // first visible one rather than failing, but keep looking if none show.
      const visible = await firstVisible(locator, count)
      if (!visible) continue

      return { locator: visible, strategy: candidate.strategy, selector: candidate.selector }
    } catch {
      // A malformed selector for one rung must not abort the ladder.
    }
  }

  return { attempted }
}

async function firstVisible(locator: Locator, count: number): Promise<Locator | null> {
  const limit = Math.min(count, 8)
  for (let i = 0; i < limit; i++) {
    const nth = locator.nth(i)
    try {
      if (await nth.isVisible()) return nth
    } catch {
      // Element detached between count and check — try the next.
    }
  }
  return null
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Minimal escaping for values interpolated into attribute selectors. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}
