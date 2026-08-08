import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, now } from '@/lib/db'
import type { RunRow, ScenarioRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { scenarioDto } from '@/lib/api/serialize'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  sourceText: z.string().min(1).max(20_000).optional(),
  mapId: z.string().max(64).nullable().optional(),
})

function owned(id: string, userId: string): ScenarioRow | undefined {
  return getDb()
    .prepare('SELECT * FROM scenarios WHERE id = ? AND user_id = ?')
    .get(id, userId) as ScenarioRow | undefined
}

export async function GET(_request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const scenario = owned(id, user.id)
  if (!scenario) return notFound('Scenario not found.')

  const runs = getDb()
    .prepare('SELECT * FROM runs WHERE scenario_id = ? ORDER BY created_at DESC LIMIT 25')
    .all(id) as RunRow[]

  return NextResponse.json({
    scenario: scenarioDto(scenario),
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      durationMs: r.duration_ms,
      aiRepairs: r.ai_repairs,
      error: r.error,
    })),
  })
}

export async function PATCH(request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const scenario = owned(id, user.id)
  if (!scenario) return notFound('Scenario not found.')

  const parsed = Patch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update.' }, { status: 400 })

  const db = getDb()
  const name = parsed.data.name?.trim() ?? scenario.name
  const sourceText = parsed.data.sourceText ?? scenario.source_text
  const mapId = parsed.data.mapId === undefined ? scenario.map_id : parsed.data.mapId || null

  if (mapId && !db.prepare('SELECT 1 FROM maps WHERE id = ? AND user_id = ?').get(mapId, user.id)) {
    return NextResponse.json({ error: 'That map was not found.' }, { status: 400 })
  }

  // Editing the text invalidates the compiled steps — replaying stale steps
  // against a rewritten scenario is worse than refusing to run.
  const textChanged = sourceText !== scenario.source_text

  db.prepare(
    `UPDATE scenarios SET name = ?, source_text = ?, map_id = ?, updated_at = ?
       ${textChanged ? ', compiled_json = NULL, compiled_at = NULL, compile_error = NULL' : ''}
     WHERE id = ?`,
  ).run(name, sourceText, mapId, now(), id)

  return NextResponse.json({ ok: true, recompileNeeded: textChanged })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  if (!owned(id, user.id)) return notFound('Scenario not found.')

  getDb().prepare('DELETE FROM scenarios WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
