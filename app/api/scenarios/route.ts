import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, newId, now } from '@/lib/db'
import type { ScenarioRow } from '@/lib/db/types'
import { requireUser } from '@/lib/auth/require'
import { validateTarget, TargetNotAllowedError } from '@/lib/crawl/url-guard'
import { scenarioDto } from '@/lib/api/serialize'

export const runtime = 'nodejs'

const Body = z.object({
  name: z.string().min(1, 'Give the scenario a name.').max(120),
  targetUrl: z.string().min(1).max(2000),
  sourceText: z.string().min(1, 'Describe the steps to run.').max(20_000),
  mapId: z.string().max(64).nullable().optional(),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const rows = getDb()
    .prepare('SELECT * FROM scenarios WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(user.id) as ScenarioRow[]

  return NextResponse.json({ scenarios: rows.map(scenarioDto) })
}

export async function POST(request: Request) {
  const { user, response } = await requireUser()
  if (response) return response

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid scenario.' },
      { status: 400 },
    )
  }

  let target
  try {
    target = await validateTarget(parsed.data.targetUrl)
  } catch (err) {
    if (err instanceof TargetNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const db = getDb()
  const mapId = parsed.data.mapId || null
  if (mapId && !db.prepare('SELECT 1 FROM maps WHERE id = ? AND user_id = ?').get(mapId, user.id)) {
    return NextResponse.json({ error: 'That map was not found.' }, { status: 400 })
  }

  const id = newId()
  db.prepare(
    `INSERT INTO scenarios (id, user_id, name, target_url, map_id, source_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, user.id, parsed.data.name.trim(), target.url, mapId, parsed.data.sourceText, now(), now())

  return NextResponse.json({ id }, { status: 201 })
}
