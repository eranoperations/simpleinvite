import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { RunRow, ScenarioRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { scenarioDto } from '@/lib/api/serialize'
import { isAiConfigured } from '@/lib/ai/config'
import { ScenarioEditor } from './scenario-editor'

export const dynamic = 'force-dynamic'

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const db = getDb()
  const scenario = db
    .prepare('SELECT * FROM scenarios WHERE id = ? AND user_id = ?')
    .get(id, user.id) as ScenarioRow | undefined
  if (!scenario) notFound()

  const runs = db
    .prepare('SELECT * FROM runs WHERE scenario_id = ? ORDER BY created_at DESC LIMIT 25')
    .all(id) as RunRow[]

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/scenarios" className="text-sm text-slate-400 hover:text-slate-200">
        ← Scenarios
      </Link>

      <ScenarioEditor
        scenario={scenarioDto(scenario)}
        aiConfigured={isAiConfigured()}
        runs={runs.map((r) => ({
          id: r.id,
          status: r.status,
          createdAt: r.created_at,
          durationMs: r.duration_ms,
          aiRepairs: r.ai_repairs,
          error: r.error,
        }))}
      />
    </main>
  )
}
