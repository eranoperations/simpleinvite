import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { ScenarioRow, WebsiteRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { formatWhen } from '@/lib/ui'
import { RunAllButton } from './run-all-button'

export const dynamic = 'force-dynamic'

export default async function WebsiteScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const db = getDb()
  const website = db
    .prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?')
    .get(id, user.id) as WebsiteRow | undefined
  if (!website) notFound()

  const scenarios = db
    .prepare('SELECT * FROM scenarios WHERE website_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(id) as ScenarioRow[]

  const lastRuns = db
    .prepare(
      `SELECT scenario_id, status, created_at FROM runs
       WHERE scenario_id IN (${scenarios.map(() => '?').join(',') || 'NULL'})
       GROUP BY scenario_id
       HAVING created_at = MAX(created_at)`,
    )
    .all(...scenarios.map((s) => s.id)) as { scenario_id: string; status: string; created_at: number }[]
  const latest = new Map(lastRuns.map((r) => [r.scenario_id, r]))
  const runnableCount = scenarios.filter((s) => s.compiled_json).length

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Describe a test in plain English. It compiles into browser steps and runs on demand.
        </p>
        <div className="flex items-center gap-3">
          {scenarios.length > 0 && <RunAllButton websiteId={id} runnableCount={runnableCount} />}
          <Link
            href={`/websites/${id}/scenarios/new`}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
          >
            New scenario
          </Link>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-slate-300">No scenarios yet.</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            Something like: “Go to the login page, sign in as demo with password demo123, open the
            profile page and change the account name to Ada.”
          </p>
          <Link
            href={`/websites/${id}/scenarios/new`}
            className="mt-6 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
          >
            Write your first scenario
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {scenarios.map((s) => {
            const run = latest.get(s.id)
            const steps = s.compiled_json ? (JSON.parse(s.compiled_json) as unknown[]).length : 0

            return (
              <li key={s.id}>
                <Link
                  href={`/websites/${id}/scenarios/${s.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 hover:border-slate-600"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="truncate font-medium">{s.name}</span>
                      {steps > 0 ? (
                        <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-200">
                          {steps} steps
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-500/40">
                          not compiled
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-6 shrink-0 text-right text-sm">
                    {run ? (
                      <>
                        <div
                          className={
                            run.status === 'complete'
                              ? 'text-emerald-400'
                              : run.status === 'failed'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                          }
                        >
                          last run {run.status}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {formatWhen(run.created_at)}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">never run</span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
