'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WebsiteDto } from '@/lib/api/serialize'

export function SettingsForm({ website }: { website: WebsiteDto }) {
  const router = useRouter()
  const [name, setName] = useState(website.name)
  const [url, setUrl] = useState(website.targetUrl)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const [confirmName, setConfirmName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/websites/${website.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteWebsite() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/websites/${website.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDeleteError(data.error ?? 'Could not delete the website.')
        return
      }
      router.push('/websites')
    } catch {
      setDeleteError('Could not reach the server.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-8 max-w-xl space-y-10">
      <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            className={INPUT}
          />
          <p className="mt-1 text-xs text-slate-500">
            Changing the URL updates the map and every scenario to point at it too. Map data
            already gathered is not cleared automatically — use Clear map on the Map tab if it no
            longer applies.
          </p>
        </label>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-emerald-400">Saved.</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
        <h2 className="text-sm font-medium text-rose-200">Delete this website</h2>
        <p className="text-xs text-rose-200/80">
          Deletes the map, every scenario and run, and every saved test user for {website.name}.
          This cannot be undone.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-xs text-rose-200/80">
            Type <span className="font-mono">{website.name}</span> to confirm
          </span>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className={INPUT}
          />
        </label>
        {deleteError && <p className="text-sm text-rose-300">{deleteError}</p>}
        <button
          onClick={deleteWebsite}
          disabled={deleting || confirmName !== website.name}
          className="rounded-lg border border-rose-500/60 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete website'}
        </button>
      </div>
    </div>
  )
}

const INPUT =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 ' +
  'outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
