'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Only accept an internal path — an attacker-supplied absolute URL here would
  // turn the login page into an open redirect.
  const rawNext = params.get('next') ?? '/websites'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/websites'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          mode === 'register' ? { email, password, name: name || undefined } : { email, password },
        ),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      router.push(next)
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {mode === 'register' && (
        <Field label="Name (optional)">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={INPUT}
          />
        </Field>
      )}

      <Field label="Email">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={INPUT}
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          className={INPUT}
        />
        {mode === 'register' && (
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        )}
      </Field>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-sky-500 px-4 py-2.5 font-medium text-white hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Log in'}
      </button>
    </form>
  )
}

const INPUT =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 ' +
  'outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-300">{label}</span>
      {children}
    </label>
  )
}
