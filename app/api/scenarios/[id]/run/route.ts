import { NextResponse } from 'next/server'
import { getDb, newId, now } from '@/lib/db'
import type { ScenarioRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { parseStepsJson } from '@/lib/scenario/steps'
import { launchRunJob } from '@/lib/jobs/run-job'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const scenario = db
    .prepare('SELECT * FROM scenarios WHERE id = ? AND user_id = ?')
    .get(id, user.id) as ScenarioRow | undefined
  if (!scenario) return notFound('Scenario not found.')

  const steps = parseStepsJson(scenario.compiled_json)
  if (!steps?.length) {
    return NextResponse.json(
      { error: 'Compile the scenario before running it.' },
      { status: 400 },
    )
  }

  const runId = newId()
  db.prepare(
    `INSERT INTO runs (id, scenario_id, user_id, status, progress_total, progress_message, created_at)
     VALUES (?, ?, ?, 'queued', ?, 'Queued', ?)`,
  ).run(runId, id, user.id, steps.length, now())

  launchRunJob(runId)

  return NextResponse.json({ id: runId }, { status: 201 })
}
