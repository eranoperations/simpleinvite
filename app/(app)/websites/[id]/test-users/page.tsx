import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { TestUserRow, WebsiteRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { testUserDto } from '@/lib/api/serialize'
import { TestUsersManager } from './test-users-manager'

export const dynamic = 'force-dynamic'

export default async function WebsiteTestUsersPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const db = getDb()
  const website = db
    .prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?')
    .get(id, user.id) as WebsiteRow | undefined
  if (!website) notFound()

  const rows = db
    .prepare('SELECT * FROM test_users WHERE website_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(id) as TestUserRow[]

  return (
    <div>
      <p className="text-sm text-slate-400">
        Save a login for {website.name} here and pick it when mapping the site — the crawler signs
        in with it first, filling the email/username and password fields and submitting, then
        keeps exploring in that signed-in session.
      </p>

      <TestUsersManager websiteId={id} initial={rows.map(testUserDto)} />
    </div>
  )
}
