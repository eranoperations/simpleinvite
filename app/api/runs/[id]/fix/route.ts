import path from 'node:path'
import { NextResponse } from 'next/server'
import { getDb, SCREENSHOT_DIR } from '@/lib/db'
import type { RunRow, RunStepRow, ScenarioRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { diagnoseRun, type RunStepSummary } from '@/lib/scenario/diagnose'
import { parseStepsJson } from '@/lib/scenario/steps'
import { AiNotConfiguredError } from '@/lib/ai/config'

export const runtime = 'nodejs'
// A single model call, but the prompt can be long for a scenario with many steps.
export const maxDuration = 300

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const run = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(id, user.id) as
    | RunRow
    | undefined
  if (!run) return notFound('Run not found.')

  if (run.status !== 'failed') {
    return NextResponse.json({ error: 'Only a failed run can be diagnosed.' }, { status: 400 })
  }

  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(run.scenario_id) as
    | ScenarioRow
    | undefined
  if (!scenario) return notFound('The scenario for this run no longer exists.')

  const steps = parseStepsJson(scenario.compiled_json)
  if (!steps?.length) {
    return NextResponse.json(
      { error: 'This scenario has no compiled steps to diagnose.' },
      { status: 400 },
    )
  }

  const runStepRows = db
    .prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY idx ASC')
    .all(id) as RunStepRow[]

  const runSteps: RunStepSummary[] = runStepRows.map((s) => ({
    idx: s.idx,
    action: s.action,
    description: s.description,
    status: s.status,
    detail: s.detail,
    selectorUsed: s.selector_used,
    url: s.url,
    consoleErrors: safeParseJson<string[]>(s.console_errors_json) ?? [],
    screenshotFile: s.screenshot_path,
  }))

  try {
    const result = await diagnoseRun({
      sourceText: scenario.source_text,
      targetUrl: scenario.target_url,
      steps,
      runSteps,
      screenshotDir: path.join(SCREENSHOT_DIR, 'runs', id),
    })
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof AiNotConfiguredError
        ? err.message
        : `Could not diagnose the run: ${(err as Error).message}`.slice(0, 500)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function safeParseJson<T>(json: string | null): T | null {
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
