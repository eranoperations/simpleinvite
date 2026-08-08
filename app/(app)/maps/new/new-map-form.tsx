'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProfileOption {
  id: string
  label: string
  description: string
}

export function NewMapForm({
  profiles,
  loginScenarios,
}: {
  profiles: ProfileOption[]
  loginScenarios: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [profile, setProfile] = useState('standard')
  const [loginScenarioId, setLoginScenarioId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url,
          depthProfile: profile,
          label: label || undefined,
          loginScenarioId: loginScenarioId || null,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Could not start the map.')
        return
      }
      router.push(`/maps/${data.id}`)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">Website URL</span>
        <input
          type="text"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com"
          className={INPUT}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">Name (optional)</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Staging environment"
          className={INPUT}
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm text-slate-300">How deep</legend>
        <div className="space-y-2">
          {profiles.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                profile === p.id
                  ? 'border-sky-500 bg-sky-500/5'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="profile"
                value={p.id}
                checked={profile === p.id}
                onChange={() => setProfile(p.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-100">{p.label}</span>
                <span className="block text-xs text-slate-400">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">
          Sign in first (optional)
        </span>
        <select
          value={loginScenarioId}
          onChange={(e) => setLoginScenarioId(e.target.value)}
          className={INPUT}
          disabled={!loginScenarios.length}
        >
          <option value="">Crawl as a signed-out visitor</option>
          {loginScenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {loginScenarios.length
            ? 'The chosen scenario runs first; the crawl then continues in that signed-in session.'
            : 'Create and compile a scenario that logs in, and it will appear here.'}
        </p>
      </label>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Start mapping'}
      </button>
    </form>
  )
}

const INPUT =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 ' +
  'outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
