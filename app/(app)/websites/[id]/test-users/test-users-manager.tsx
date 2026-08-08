'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TestUserDto } from '@/lib/api/serialize'
import { formatWhen } from '@/lib/ui'

export function TestUsersManager({ websiteId, initial }: { websiteId: string; initial: TestUserDto[] }) {
  const router = useRouter()
  const [testUsers, setTestUsers] = useState(initial)
  const [label, setLabel] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginPath, setLoginPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/websites/${websiteId}/test-users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label, username, password, loginPath: loginPath || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save the test user.')
        return
      }
      setTestUsers((prev) => [
        { id: data.id, label, username, loginPath: loginPath || null, createdAt: Date.now() },
        ...prev,
      ])
      setLabel('')
      setUsername('')
      setPassword('')
      setLoginPath('')
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/test-users/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTestUsers((prev) => prev.filter((t) => t.id !== id))
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mt-8 space-y-10">
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium text-slate-300">Add a test user</h2>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Name</span>
          <input
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Demo member account"
            className={INPUT}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Email or username</span>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="demo@example.com"
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={INPUT}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Login page path (optional)</span>
          <input
            type="text"
            value={loginPath}
            onChange={(e) => setLoginPath(e.target.value)}
            placeholder="/login"
            className={INPUT}
          />
          <p className="mt-1 text-xs text-slate-500">Defaults to /login on this website.</p>
        </label>

        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          The password is stored as written, the same way a scenario&rsquo;s is. Use a dedicated
          test account, not a real one.
        </p>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save test user'}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">Saved test users</h2>
        {testUsers.length === 0 ? (
          <p className="text-sm text-slate-500">
            None yet — add one above to use it when mapping this site.
          </p>
        ) : (
          <ul className="space-y-2">
            {testUsers.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-100">{t.label}</span>
                    <span className="truncate text-xs text-slate-500">{t.username}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    signs in at {t.loginPath || '/login'} · added {formatWhen(t.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  disabled={deletingId === t.id}
                  className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:border-rose-500 hover:text-rose-300 disabled:opacity-50"
                >
                  {deletingId === t.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const INPUT =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 ' +
  'outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
