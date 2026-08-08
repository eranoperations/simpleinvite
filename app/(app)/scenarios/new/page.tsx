import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { MapRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { NewScenarioForm } from './new-scenario-form'

export const dynamic = 'force-dynamic'

export default async function NewScenarioPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const maps = getDb()
    .prepare(
      `SELECT id, hostname, label, target_url FROM maps
       WHERE user_id = ? AND status = 'complete'
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all(user.id) as Pick<MapRow, 'id' | 'hostname' | 'label' | 'target_url'>[]

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/scenarios" className="text-sm text-slate-400 hover:text-slate-200">
        ← Scenarios
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">New scenario</h1>
      <p className="mt-2 text-sm text-slate-400">
        Write the test the way you would explain it to someone. Pick the map of the site it runs
        against and the compiler will use that site&rsquo;s real pages and field names.
      </p>

      <NewScenarioForm
        maps={maps.map((m) => ({
          id: m.id,
          name: m.label || m.hostname,
          targetUrl: m.target_url,
        }))}
      />
    </main>
  )
}
