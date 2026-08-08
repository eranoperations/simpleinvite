import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { RunRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { runDto } from '@/lib/api/serialize'
import { RunTimeline } from './run-timeline'

export const dynamic = 'force-dynamic'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const row = getDb()
    .prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?')
    .get(id, user.id) as RunRow | undefined
  if (!row) notFound()

  const scenario = getDb()
    .prepare('SELECT name FROM scenarios WHERE id = ?')
    .get(row.scenario_id) as { name: string } | undefined

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/scenarios/${row.scenario_id}`}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← {scenario?.name ?? 'Scenario'}
      </Link>
      <RunTimeline initialRun={runDto(row, scenario?.name ?? 'Scenario')} />
    </main>
  )
}
