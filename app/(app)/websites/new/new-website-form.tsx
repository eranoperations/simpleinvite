'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewWebsiteForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, url }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Could not create the website.')
        return
      }
      router.push(`/websites/${data.id}`)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Staging environment"
          className={INPUT}
        />
      </label>

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
        {busy ? 'Creating…' : 'Create website'}
      </button>
    </form>
  )
}

const INPUT =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 ' +
  'outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
