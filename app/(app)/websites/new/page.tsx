import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { NewWebsiteForm } from './new-website-form'

export const dynamic = 'force-dynamic'

export default async function NewWebsitePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/websites" className="text-sm text-slate-400 hover:text-slate-200">
        ← Websites
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">New website</h1>
      <p className="mt-2 text-sm text-slate-400">
        Give it a URL. Once it&rsquo;s created you can map it, write test scenarios against it,
        and save test accounts to sign in with.
      </p>

      <NewWebsiteForm />
    </main>
  )
}
