import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { MapRow, ScenarioRow, TestUserRow, WebsiteRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { mapGraph, mapSummary } from '@/lib/api/serialize'
import { PROFILES } from '@/lib/crawl/profiles'
import { MapView } from './map-view'

export const dynamic = 'force-dynamic'

export default async function WebsiteMapPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const db = getDb()
  const website = db
    .prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?')
    .get(id, user.id) as WebsiteRow | undefined
  if (!website) notFound()

  const map = db.prepare('SELECT * FROM maps WHERE website_id = ?').get(id) as MapRow | undefined
  if (!map) notFound()

  const loginScenarios = db
    .prepare(
      `SELECT id, name FROM scenarios
       WHERE website_id = ? AND compiled_json IS NOT NULL
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all(id) as Pick<ScenarioRow, 'id' | 'name'>[]

  const testUsers = db
    .prepare(
      `SELECT id, label, username FROM test_users WHERE website_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(id) as Pick<TestUserRow, 'id' | 'label' | 'username'>[]

  return (
    <MapView
      websiteId={id}
      initialMap={mapSummary(map)}
      initialGraph={mapGraph(map.id, map.target_url)}
      profiles={Object.values(PROFILES).map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
      }))}
      loginScenarios={loginScenarios}
      testUsers={testUsers.map((t) => ({ id: t.id, name: `${t.label} (${t.username})` }))}
    />
  )
}
