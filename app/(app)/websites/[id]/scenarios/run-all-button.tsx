'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RunAllButton({ websiteId, runnableCount }: { websiteId: string; runnableCount: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function runAll() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/websites/${websiteId}/scenarios/run-all`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error ?? 'Could not start the runs.')
        return
      }
      const { started, skipped } = data as { started: unknown[]; skipped: unknown[] }
      setMessage(
        started.length === 0
          ? 'Nothing to run — compile a scenario first.'
          : `Started ${started.length} run${started.length === 1 ? '' : 's'}` +
              (skipped.length ? `, skipped ${skipped.length} not compiled.` : '.'),
      )
      router.refresh()
    } catch {
      setMessage('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-slate-400">{message}</span>}
      <button
        onClick={runAll}
        disabled={busy || runnableCount === 0}
        title={runnableCount === 0 ? 'No compiled scenarios to run' : undefined}
        className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500 disabled:opacity-50"
      >
        {busy ? 'Starting…' : `Run all (${runnableCount})`}
      </button>
    </div>
  )
}
