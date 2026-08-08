import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { MapRow, WebsiteRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { statusClass } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function WebsitesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = getDb()
  const websites = db
    .prepare('SELECT * FROM websites WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(user.id) as WebsiteRow[]

  const maps = db
    .prepare(
      `SELECT * FROM maps WHERE website_id IN (${websites.map(() => '?').join(',') || 'NULL'})`,
    )
    .all(...websites.map((w) => w.id)) as MapRow[]
  const mapByWebsite = new Map(maps.map((m) => [m.website_id, m]))

  const scenarioCounts = db
    .prepare(
      `SELECT website_id, COUNT(*) as count FROM scenarios
       WHERE website_id IN (${websites.map(() => '?').join(',') || 'NULL'})
       GROUP BY website_id`,
    )
    .all(...websites.map((w) => w.id)) as { website_id: string; count: number }[]
  const scenarioCountByWebsite = new Map(scenarioCounts.map((s) => [s.website_id, s.count]))

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Websites</h1>
          <p className="mt-1 text-sm text-slate-400">
            Each website has one map, its own test scenarios and its own test users.
          </p>
        </div>
        <Link
          href="/websites/new"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
        >
          New website
        </Link>
      </div>

      {websites.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-slate-300">No websites yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Add a website to map it, write test scenarios against it, and save test accounts for
            signing in.
          </p>
          <Link
            href="/websites/new"
            className="mt-6 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
          >
            Add your first website
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {websites.map((website) => {
            const map = mapByWebsite.get(website.id)
            const scenarioCount = scenarioCountByWebsite.get(website.id) ?? 0
            const stats = map?.stats_json ? (JSON.parse(map.stats_json) as Record<string, number>) : null

            return (
              <li key={website.id}>
                <Link
                  href={`/websites/${website.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 hover:border-slate-600"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="truncate font-medium">{website.name}</span>
                      {map && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ring-1 ${statusClass(map.status)}`}
                        >
                          {map.status === 'idle' ? 'not mapped' : map.status}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">{website.target_url}</p>
                  </div>

                  <div className="ml-6 shrink-0 text-right text-sm text-slate-400">
                    <div className="text-slate-300">
                      {stats ? `${stats.pages} pages · ${stats.edges} connections` : 'no map data'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {scenarioCount} scenario{scenarioCount === 1 ? '' : 's'}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
