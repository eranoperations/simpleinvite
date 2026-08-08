import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { MapRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { mapGraph, mapSummary } from '@/lib/api/serialize'
import { MapView } from './map-view'

export const dynamic = 'force-dynamic'

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const row = getDb()
    .prepare('SELECT * FROM maps WHERE id = ? AND user_id = ?')
    .get(id, user.id) as MapRow | undefined
  if (!row) notFound()

  return (
    <main className="px-6 py-6">
      <Link href="/maps" className="text-sm text-slate-400 hover:text-slate-200">
        ← Maps
      </Link>
      <MapView
        initialMap={mapSummary(row)}
        initialGraph={mapGraph(row.id, row.target_url)}
      />
    </main>
  )
}
