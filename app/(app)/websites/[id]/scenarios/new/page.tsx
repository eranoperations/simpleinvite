import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { WebsiteRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { NewScenarioForm } from './new-scenario-form'

export const dynamic = 'force-dynamic'

export default async function NewWebsiteScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const website = getDb()
    .prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?')
    .get(id, user.id) as WebsiteRow | undefined
  if (!website) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/websites/${id}/scenarios`} className="text-sm text-slate-400 hover:text-slate-200">
        ← Scenarios
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">New scenario</h1>
      <p className="mt-2 text-sm text-slate-400">
        Write the test the way you would explain it to someone. It compiles against{' '}
        {website.name}&rsquo;s real pages and field names, using whatever the map has found so far.
      </p>

      <NewScenarioForm websiteId={id} />
    </div>
  )
}
