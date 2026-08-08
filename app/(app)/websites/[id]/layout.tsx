import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { WebsiteRow } from '@/lib/db/types'
import { getSessionUser } from '@/lib/auth/session'
import { WebsiteTabs } from './website-tabs'

export const dynamic = 'force-dynamic'

export default async function WebsiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
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
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link href="/websites" className="text-sm text-slate-400 hover:text-slate-200">
        ← Websites
      </Link>
      <div className="mt-4">
        <h1 className="text-2xl font-semibold">{website.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{website.target_url}</p>
      </div>

      <WebsiteTabs websiteId={id} />

      <div className="mt-6">{children}</div>
    </main>
  )
}
