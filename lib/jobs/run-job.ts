import path from 'node:path'
import { getDb, newId, now, SCREENSHOT_DIR } from '@/lib/db'
import type { RunRow, ScenarioRow } from '@/lib/db/types'
import { launchBrowser, newContext } from '@/lib/crawl/browser'
import { executeSteps, type StepOutcome } from '@/lib/scenario/executor'
import { parseStepsJson, type Step } from '@/lib/scenario/steps'
import { acquireSlot, register, releaseSlot, unregister } from './registry'

export async function runScenarioJob(runId: string): Promise<void> {
  const db = getDb()
  const controller = register(runId)
  const startedAt = now()

  try {
    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as RunRow | undefined
    if (!run) return

    const scenario = db
      .prepare('SELECT * FROM scenarios WHERE id = ?')
      .get(run.scenario_id) as ScenarioRow | undefined
    if (!scenario) throw new Error('The scenario was deleted before this run started.')

    const steps = parseStepsJson(scenario.compiled_json)
    if (!steps?.length) {
      throw new Error('This scenario has no compiled steps yet. Compile it, then run it.')
    }

    db.prepare(
      `UPDATE runs SET status = 'running', started_at = ?, progress_total = ?,
         progress_message = 'Waiting for a browser' WHERE id = ?`,
    ).run(startedAt, steps.length, runId)

    await acquireSlot()
    try {
      const screenshotDir = path.join(SCREENSHOT_DIR, 'runs', runId)
      const browser = await launchBrowser()

      try {
        const context = await newContext(browser)
        const learned = new Map<number, string>()

        const result = await executeSteps(context, {
          steps,
          baseUrl: scenario.target_url,
          screenshotDir,
          signal: controller.signal,
          noRepair: process.env.DISABLE_AI_REPAIR === 'true',
          onProgress: (current, total, message) => {
            db.prepare(
              'UPDATE runs SET progress_current = ?, progress_total = ?, progress_message = ? WHERE id = ?',
            ).run(current, total, message, runId)
          },
          onStep: (outcome) => {
            writeStep(runId, outcome)
            if (outcome.learnedSelector) learned.set(outcome.idx, outcome.learnedSelector)
          },
        })

        // A repaired selector is written back so the next run of this scenario
        // resolves deterministically and never pays for AI again.
        if (learned.size) persistLearnedSelectors(scenario, steps, learned)

        const cancelled = controller.signal.aborted
        db.prepare(
          `UPDATE runs SET status = ?, finished_at = ?, duration_ms = ?, ai_repairs = ?,
             progress_message = ? WHERE id = ?`,
        ).run(
          cancelled ? 'cancelled' : result.failed ? 'failed' : 'complete',
          now(),
          now() - startedAt,
          result.repairs,
          cancelled ? 'Cancelled' : result.failed ? 'Failed' : 'All steps passed',
          runId,
        )

        if (result.failed && !cancelled) {
          const failed = result.outcomes.find((o) => o.status === 'failed')
          db.prepare('UPDATE runs SET error = ? WHERE id = ?').run(
            `Step ${(failed?.idx ?? 0) + 1} failed: ${failed?.detail ?? 'unknown reason'}`.slice(0, 500),
            runId,
          )
        }
      } finally {
        await browser.close().catch(() => {})
      }
    } finally {
      releaseSlot()
    }
  } catch (err) {
    db.prepare(
      `UPDATE runs SET status = 'failed', error = ?, finished_at = ?, duration_ms = ?,
         progress_message = 'Failed' WHERE id = ?`,
    ).run(
      ((err as Error).message || 'Run failed').slice(0, 500),
      now(),
      now() - startedAt,
      runId,
    )
  } finally {
    unregister(runId)
  }
}

function writeStep(runId: string, outcome: StepOutcome): void {
  getDb()
    .prepare(
      `INSERT INTO run_steps
         (id, run_id, idx, action, description, detail, selector_used, status, url,
          duration_ms, screenshot_path, console_errors_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId(),
      runId,
      outcome.idx,
      outcome.action,
      outcome.description,
      outcome.detail,
      outcome.selectorUsed,
      outcome.status,
      outcome.url,
      outcome.durationMs,
      outcome.screenshotFile,
      JSON.stringify(outcome.consoleErrors),
    )
}

function persistLearnedSelectors(
  scenario: ScenarioRow,
  steps: Step[],
  learned: Map<number, string>,
): void {
  const updated = steps.map((step, idx) => {
    const selector = learned.get(idx)
    if (!selector || !('target' in step)) return step
    return { ...step, selector }
  })

  getDb()
    .prepare('UPDATE scenarios SET compiled_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(updated), now(), scenario.id)
}

export function launchRunJob(runId: string): void {
  void runScenarioJob(runId).catch((err) => {
    console.error(`[run ${runId}] unhandled:`, err)
  })
}
