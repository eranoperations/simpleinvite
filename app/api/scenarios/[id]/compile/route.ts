import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, now } from '@/lib/db'
import type { ScenarioRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { compileScenario } from '@/lib/scenario/compile'
import { parseSteps } from '@/lib/scenario/steps'
import { AiNotConfiguredError } from '@/lib/ai/config'

export const runtime = 'nodejs'
// Compilation is one model call; it can outlast the default serverless budget.
export const maxDuration = 300

const Body = z
  .object({
    /** Hand-written steps, letting the whole feature work with no AI at all. */
    steps: z.unknown().optional(),
  })
  .optional()

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const scenario = db
    .prepare('SELECT * FROM scenarios WHERE id = ? AND user_id = ?')
    .get(id, user.id) as ScenarioRow | undefined
  if (!scenario) return notFound('Scenario not found.')

  const body = Body.parse(await request.json().catch(() => ({})))

  try {
    const steps = body?.steps
      ? parseSteps(body.steps)
      : await compileScenario({
          sourceText: scenario.source_text,
          targetUrl: scenario.target_url,
          mapId: scenario.map_id,
        })

    db.prepare(
      `UPDATE scenarios SET compiled_json = ?, compiled_at = ?, compile_error = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(JSON.stringify(steps), now(), now(), id)

    return NextResponse.json({ steps })
  } catch (err) {
    const message =
      err instanceof AiNotConfiguredError
        ? err.message
        : `Could not compile the scenario: ${(err as Error).message}`.slice(0, 500)

    db.prepare('UPDATE scenarios SET compile_error = ?, updated_at = ? WHERE id = ?').run(
      message,
      now(),
      id,
    )
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
