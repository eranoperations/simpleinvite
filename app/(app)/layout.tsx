import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { SignOutButton } from './sign-out-button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware only proves a cookie exists. This is the real check.
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/maps" className="font-semibold tracking-tight">
              AIS<span className="text-sky-400">Centry</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/maps">Maps</NavLink>
              <NavLink href="/scenarios">Scenarios</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="hidden sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
    >
      {children}
    </Link>
  )
}
