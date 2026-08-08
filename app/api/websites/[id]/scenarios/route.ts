import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, newId, now } from '@/lib/db'
import type { ScenarioRow, WebsiteRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { scenarioDto } from '@/lib/api/serialize'

export const runtime = 'nodejs'

const Body = z.object({
  name: z.string().min(1, 'Give the scenario a name.').max(120),
  sourceText: z.string().min(1, 'Describe the steps to run.').max(20_000),
  stepDelayMs: z.number().int().min(0).max(30_000).optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const website = db.prepare('SELECT 1 FROM websites WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!website) return notFound('Website not found.')

  const rows = db
    .prepare('SELECT * FROM scenarios WHERE website_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(id) as ScenarioRow[]

  return NextResponse.json({ scenarios: rows.map(scenarioDto) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const website = db.prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?').get(id, user.id) as
    | WebsiteRow
    | undefined
  if (!website) return notFound('Website not found.')

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid scenario.' },
      { status: 400 },
    )
  }

  const scenarioId = newId()
  db.prepare(
    `INSERT INTO scenarios
       (id, user_id, website_id, name, target_url, source_text, step_delay_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    scenarioId,
    user.id,
    id,
    parsed.data.name.trim(),
    website.target_url,
    parsed.data.sourceText,
    parsed.data.stepDelayMs ?? 1000,
    now(),
    now(),
  )

  return NextResponse.json({ id: scenarioId }, { status: 201 })
}
