import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { MapRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { mapSummary } from '@/lib/api/serialize'
import { formatDuration, formatWhen, statusClass } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function MapsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const rows = getDb()
    .prepare('SELECT * FROM maps WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(user.id) as MapRow[]
  const maps = rows.map(mapSummary)

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Site maps</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every page found, and the link or button that leads to it.
          </p>
        </div>
        <Link
          href="/maps/new"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
        >
          New map
        </Link>
      </div>

      {maps.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-slate-300">No maps yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Map a site first — its pages and fields become the vocabulary your test scenarios
            compile against.
          </p>
          <Link
            href="/maps/new"
            className="mt-6 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
          >
            Map your first site
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {maps.map((map) => (
            <li key={map.id}>
              <Link
                href={`/maps/${map.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 hover:border-slate-600"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="truncate font-medium">{map.label || map.hostname}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ring-1 ${statusClass(map.status)}`}
                    >
                      {map.status}
                    </span>
                    {map.authenticated && (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300 ring-1 ring-violet-500/40">
                        signed in
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">{map.targetUrl}</p>
                  {map.status === 'running' && (
                    <p className="mt-1 text-sm text-sky-400">
                      {map.progress.message} ({map.progress.current}/{map.progress.total})
                    </p>
                  )}
                  {map.error && <p className="mt-1 text-sm text-rose-400">{map.error}</p>}
                </div>

                <div className="ml-6 shrink-0 text-right text-sm text-slate-400">
                  {map.stats && (
                    <div className="text-slate-300">
                      {map.stats.pages} pages · {map.stats.edges} connections
                    </div>
                  )}
                  <div className="mt-1 text-xs text-slate-500">
                    {formatWhen(map.createdAt)}
                    {map.stats?.durationMs ? ` · ${formatDuration(map.stats.durationMs)}` : ''}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
