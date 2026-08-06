export type ScanDepth = 'quick' | 'medium' | 'deep'

export interface ScanProfile {
  id: ScanDepth
  label: string
  blurb: string
  /** Hard cap on pages crawled. */
  maxPages: number
  /** Link-following depth from the entry URL. */
  maxDepth: number
  /** Click non-navigating interactive elements to surface runtime errors. */
  interact: boolean
  /** Interactive elements exercised per page when `interact` is on. */
  maxInteractionsPerPage: number
  /** Re-render each page at mobile width to catch responsive breakage. */
  responsiveCheck: boolean
  /** Probe for common exposed files (GET only, non-destructive). */
  exposureProbes: boolean
  /** Ask the model for a focused per-page pass in addition to the site pass. */
  perPageAnalysis: boolean
  /** Milliseconds to settle after load before auditing. */
  settleMs: number
  estimate: string
}

export const PROFILES: Record<ScanDepth, ScanProfile> = {
  quick: {
    id: 'quick',
    label: 'Quick scan',
    blurb:
      'Entry page plus its most important links. Security headers, obvious bugs, first-impression UX.',
    maxPages: 3,
    maxDepth: 1,
    interact: false,
    maxInteractionsPerPage: 0,
    responsiveCheck: false,
    exposureProbes: false,
    perPageAnalysis: false,
    settleMs: 1200,
    estimate: '~1-2 minutes',
  },
  medium: {
    id: 'medium',
    label: 'Standard scan',
    blurb:
      'Crawls the main sections, clicks through interactive elements, checks mobile layout and forms.',
    maxPages: 12,
    maxDepth: 2,
    interact: true,
    maxInteractionsPerPage: 8,
    responsiveCheck: true,
    exposureProbes: true,
    perPageAnalysis: false,
    settleMs: 1800,
    estimate: '~5-10 minutes',
  },
  deep: {
    id: 'deep',
    label: 'Deep dive',
    blurb:
      'Exhaustive crawl. Every reachable page, every button, forms, mobile and desktop, exposed-file probes, and a per-page AI review on top of the site-wide report.',
    maxPages: 40,
    maxDepth: 4,
    interact: true,
    maxInteractionsPerPage: 25,
    responsiveCheck: true,
    exposureProbes: true,
    perPageAnalysis: true,
    settleMs: 2500,
    estimate: '~20-40 minutes',
  },
}

export const DEPTHS = Object.keys(PROFILES) as ScanDepth[]

export function getProfile(depth: string): ScanProfile {
  const profile = PROFILES[depth as ScanDepth]
  if (!profile) throw new Error(`Unknown scan depth: ${depth}`)
  return profile
}
