import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, newId, now } from '@/lib/db'
import type { MapRow } from '@/lib/db/types'
import { requireUser } from '@/lib/auth/require'
import { validateTarget, TargetNotAllowedError } from '@/lib/crawl/url-guard'
import { PROFILES } from '@/lib/crawl/profiles'
import { launchMapJob } from '@/lib/jobs/map-job'
import { mapSummary } from '@/lib/api/serialize'

export const runtime = 'nodejs'

const Body = z.object({
  url: z.string().min(1).max(2000),
  depthProfile: z.enum(['quick', 'standard', 'deep']).default('standard'),
  label: z.string().max(120).optional(),
  loginScenarioId: z.string().max(64).nullable().optional(),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const rows = getDb()
    .prepare('SELECT * FROM maps WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(user.id) as MapRow[]

  return NextResponse.json({ maps: rows.map(mapSummary) })
}

export async function POST(request: Request) {
  const { user, response } = await requireUser()
  if (response) return response

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a website URL to map.' }, { status: 400 })
  }

  let target
  try {
    target = await validateTarget(parsed.data.url)
  } catch (err) {
    if (err instanceof TargetNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const db = getDb()

  // A login scenario must belong to the caller — otherwise this endpoint would
  // run another user's credentials on demand.
  const loginScenarioId = parsed.data.loginScenarioId || null
  if (loginScenarioId) {
    const owned = db
      .prepare('SELECT 1 FROM scenarios WHERE id = ? AND user_id = ?')
      .get(loginScenarioId, user.id)
    if (!owned) {
      return NextResponse.json({ error: 'That sign-in scenario was not found.' }, { status: 400 })
    }
  }

  const id = newId()
  db.prepare(
    `INSERT INTO maps (id, user_id, target_url, hostname, label, status, depth_profile,
       login_scenario_id, progress_total, progress_message, created_at)
     VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, 'Queued', ?)`,
  ).run(
    id,
    user.id,
    target.url,
    target.hostname,
    parsed.data.label?.trim() || null,
    parsed.data.depthProfile,
    loginScenarioId,
    PROFILES[parsed.data.depthProfile].maxPages,
    now(),
  )

  launchMapJob(id)

  return NextResponse.json({ id }, { status: 201 })
}
