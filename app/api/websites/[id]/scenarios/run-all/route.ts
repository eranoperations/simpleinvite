import { NextResponse } from 'next/server'
import { getDb, newId, now } from '@/lib/db'
import type { ScenarioRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { parseStepsJson } from '@/lib/scenario/steps'
import { launchRunJob } from '@/lib/jobs/run-job'

export const runtime = 'nodejs'

/**
 * Queues every compiled scenario on this website. Each run goes through the
 * same job registry as a single run, so the concurrency cap (MAX_CONCURRENT_JOBS)
 * still applies — this just queues them all at once rather than one at a time.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const website = db.prepare('SELECT 1 FROM websites WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!website) return notFound('Website not found.')

  const scenarios = db
    .prepare('SELECT * FROM scenarios WHERE website_id = ? ORDER BY created_at DESC')
    .all(id) as ScenarioRow[]

  const started: { id: string; scenarioId: string; scenarioName: string }[] = []
  const skipped: { scenarioId: string; scenarioName: string }[] = []

  for (const scenario of scenarios) {
    const steps = parseStepsJson(scenario.compiled_json)
    if (!steps?.length) {
      skipped.push({ scenarioId: scenario.id, scenarioName: scenario.name })
      continue
    }

    const runId = newId()
    db.prepare(
      `INSERT INTO runs (id, scenario_id, user_id, status, progress_total, progress_message, created_at)
       VALUES (?, ?, ?, 'queued', ?, 'Queued', ?)`,
    ).run(runId, scenario.id, user.id, steps.length, now())

    launchRunJob(runId)
    started.push({ id: runId, scenarioId: scenario.id, scenarioName: scenario.name })
  }

  return NextResponse.json({ started, skipped }, { status: 201 })
}
