import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { ScenarioRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { PROFILES } from '@/lib/crawl/profiles'
import { NewMapForm } from './new-map-form'

export const dynamic = 'force-dynamic'

export default async function NewMapPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Only compiled scenarios can drive an authenticated crawl.
  const scenarios = getDb()
    .prepare(
      `SELECT id, name FROM scenarios
       WHERE user_id = ? AND compiled_json IS NOT NULL
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all(user.id) as Pick<ScenarioRow, 'id' | 'name'>[]

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/maps" className="text-sm text-slate-400 hover:text-slate-200">
        ← Maps
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Map a site</h1>
      <p className="mt-2 text-sm text-slate-400">
        A real browser walks the site, following links and clicking buttons to find where each one
        leads.
      </p>

      <NewMapForm
        profiles={Object.values(PROFILES).map((p) => ({
          id: p.id,
          label: p.label,
          description: p.description,
        }))}
        loginScenarios={scenarios}
      />
    </main>
  )
}
