import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, now } from '@/lib/db'
import type { MapRow, WebsiteRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { PROFILES } from '@/lib/crawl/profiles'
import { launchMapJob } from '@/lib/jobs/map-job'

export const runtime = 'nodejs'

const Body = z.object({
  depthProfile: z.enum(['quick', 'standard', 'deep']).default('standard'),
  loginScenarioId: z.string().max(64).nullable().optional(),
  testUserId: z.string().max(64).nullable().optional(),
})

/**
 * Starts (or re-runs) the crawl for this website's one map. The map row
 * already exists — created alongside the website — so this only ever updates
 * it and launches the job; it never creates a second map.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const website = db.prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?').get(id, user.id) as
    | WebsiteRow
    | undefined
  if (!website) return notFound('Website not found.')

  const map = db.prepare('SELECT * FROM maps WHERE website_id = ?').get(id) as MapRow | undefined
  if (!map) return notFound('This website has no map.')

  if (map.status === 'queued' || map.status === 'running') {
    return NextResponse.json({ error: 'A crawl is already running for this website.' }, { status: 409 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid crawl settings.' }, { status: 400 })
  }

  const loginScenarioId = parsed.data.loginScenarioId || null
  const testUserId = parsed.data.testUserId || null
  if (loginScenarioId && testUserId) {
    return NextResponse.json(
      { error: 'Choose either a sign-in scenario or a test user, not both.' },
      { status: 400 },
    )
  }

  // Sign-in options must belong to the same website — otherwise this endpoint
  // would let one site's crawl run another site's credentials.
  if (
    loginScenarioId &&
    !db.prepare('SELECT 1 FROM scenarios WHERE id = ? AND website_id = ?').get(loginScenarioId, id)
  ) {
    return NextResponse.json({ error: 'That sign-in scenario was not found.' }, { status: 400 })
  }
  if (
    testUserId &&
    !db.prepare('SELECT 1 FROM test_users WHERE id = ? AND website_id = ?').get(testUserId, id)
  ) {
    return NextResponse.json({ error: 'That test user was not found.' }, { status: 400 })
  }

  db.prepare(
    `UPDATE maps SET status = 'queued', depth_profile = ?, login_scenario_id = ?, test_user_id = ?,
       progress_current = 0, progress_total = ?, progress_message = 'Queued', error = NULL,
       started_at = NULL, finished_at = NULL
     WHERE id = ?`,
  ).run(
    parsed.data.depthProfile,
    loginScenarioId,
    testUserId,
    PROFILES[parsed.data.depthProfile].maxPages,
    map.id,
  )

  launchMapJob(map.id)

  return NextResponse.json({ id: map.id }, { status: 202 })
}
