'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)

    const res = await signIn('credentials', { email, password, redirect: false })

    if (res?.error) {
      setError('That email and password combination did not work.')
      setBusy(false)
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-200">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-white placeholder-ink-400 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-200">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-white placeholder-ink-400 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          placeholder="••••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <span className="text-lg">🛡️</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">SiteSentry</span>
        </Link>

        <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-7">
          <h1 className="mb-1 text-xl font-semibold text-white">Welcome back</h1>
          <p className="mb-6 text-sm text-ink-400">Sign in to run and review scans.</p>

          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-ink-400">
          No account yet?{' '}
          <Link href="/register" className="text-accent-bright transition hover:text-white">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
