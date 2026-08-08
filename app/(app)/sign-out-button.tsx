'use client'

import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
        router.refresh()
      }}
      className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-slate-200"
    >
      Sign out
    </button>
  )
}
