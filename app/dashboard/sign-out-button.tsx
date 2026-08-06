'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="rounded-lg border border-ink-700 px-3 py-1.5 text-ink-300 transition hover:border-ink-600 hover:text-white"
    >
      Sign out
    </button>
  )
}
