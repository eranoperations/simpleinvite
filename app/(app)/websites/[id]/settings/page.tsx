import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { WebsiteRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { websiteDto } from '@/lib/api/serialize'
import { SettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export default async function WebsiteSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const website = getDb()
    .prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?')
    .get(id, user.id) as WebsiteRow | undefined
  if (!website) notFound()

  return <SettingsForm website={websiteDto(website)} />
}
