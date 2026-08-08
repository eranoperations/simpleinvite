export type DepthProfile = 'quick' | 'standard' | 'deep'

export interface CrawlProfile {
  id: DepthProfile
  label: string
  description: string
  maxPages: number
  maxDepth: number
  /** Clicking controls is what finds button edges — set to 0 to map links only. */
  maxClicksPerPage: number
  settleMs: number
  screenshots: boolean
}

export const PROFILES: Record<DepthProfile, CrawlProfile> = {
  quick: {
    id: 'quick',
    label: 'Quick',
    description: 'Up to 8 pages, 2 levels deep. Links only — no button clicking.',
    maxPages: 8,
    maxDepth: 2,
    maxClicksPerPage: 0,
    settleMs: 400,
    screenshots: true,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Up to 25 pages, 3 levels deep. Clicks up to 10 buttons per page.',
    maxPages: 25,
    maxDepth: 3,
    maxClicksPerPage: 10,
    settleMs: 700,
    screenshots: true,
  },
  deep: {
    id: 'deep',
    label: 'Deep',
    description: 'Up to 60 pages, 4 levels deep. Clicks up to 25 buttons per page.',
    maxPages: 60,
    maxDepth: 4,
    maxClicksPerPage: 25,
    settleMs: 900,
    screenshots: true,
  },
}

export function getProfile(id: string): CrawlProfile {
  return PROFILES[id as DepthProfile] ?? PROFILES.standard
}
