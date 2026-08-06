'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEPTHS, PROFILES, type ScanDepth } from '@/lib/scanner/profiles'

export function NewScanForm({ onStarted }: { onStarted: () => void }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [depth, setDepth] = useState<ScanDepth>('medium')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!confirmed) {
      setError('Confirm you own this site or have permission to test it.')
      return
    }

    setBusy(true)

    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, depth, ownershipConfirmed: true }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Could not start the scan.')
        setBusy(false)
        return
      }

      setUrl('')
      setConfirmed(false)
      setBusy(false)
      onStarted()
      router.push(`/dashboard/scans/${data.id}`)
    } catch {
      setError('Could not reach the server. Try again.')
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-ink-800 bg-ink-900/40 p-6 sm:p-7"
    >
      <h2 className="text-lg font-semibold text-white">New scan</h2>
      <p className="mt-1 text-sm text-ink-400">
        Enter a site and pick how deep to go. You&apos;ll watch it work in real time.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="url" className="mb-1.5 block text-sm font-medium text-ink-200">
          Website URL
        </label>
        <input
          id="url"
          type="text"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com"
          className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3.5 py-2.5 text-white placeholder-ink-400 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2.5 text-sm font-medium text-ink-200">Scan depth</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {DEPTHS.map((d) => {
            const p = PROFILES[d]
            const active = depth === d
            return (
              <label
                key={d}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  active
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                    : 'border-ink-700 bg-ink-950/50 hover:border-ink-600'
                }`}
              >
                <input
                  type="radio"
                  name="depth"
                  value={d}
                  checked={active}
                  onChange={() => setDepth(d)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{p.label}</span>
                  <span
                    className={`h-3.5 w-3.5 rounded-full border-2 transition ${
                      active ? 'border-accent bg-accent' : 'border-ink-600'
                    }`}
                  />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{p.blurb}</p>
                <p className="mt-2.5 text-xs font-medium text-ink-300">
                  {p.maxPages} pages · {p.estimate}
                </p>
              </label>
            )
          })}
        </div>
      </fieldset>

      <label className="mt-6 flex cursor-pointer items-start gap-2.5 text-sm text-ink-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-950 accent-accent"
        />
        <span>
          I own this website or have permission to test it. SiteSentry loads pages and clicks
          controls like a real visitor would.
        </span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-3 font-medium text-white transition hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {busy ? 'Starting…' : 'Start scan'}
      </button>
    </form>
  )
}
