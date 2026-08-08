/** Shared presentation helpers, kept out of components so both server and
 *  client trees can use them without duplicating strings. */

export const STATUS_STYLES: Record<string, string> = {
  idle: 'bg-slate-800/60 text-slate-400 ring-slate-600/40',
  queued: 'bg-slate-700/60 text-slate-200 ring-slate-500/40',
  running: 'bg-sky-500/15 text-sky-300 ring-sky-500/40',
  complete: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  failed: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
  cancelled: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
}

export const STEP_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  passed: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Passed' },
  repaired: { dot: 'bg-violet-400', text: 'text-violet-300', label: 'Repaired by AI' },
  failed: { dot: 'bg-rose-400', text: 'text-rose-300', label: 'Failed' },
  skipped: { dot: 'bg-slate-600', text: 'text-slate-400', label: 'Skipped' },
  pending: { dot: 'bg-slate-600', text: 'text-slate-400', label: 'Pending' },
  running: { dot: 'bg-sky-400', text: 'text-sky-300', label: 'Running' },
}

export function statusClass(status: string): string {
  return STATUS_STYLES[status] ?? STATUS_STYLES.queued
}

export function formatDuration(ms: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function formatWhen(timestamp: number | null): string {
  if (!timestamp) return '—'
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

export function statusCodeClass(code: number): string {
  if (code === 0) return 'text-slate-500'
  if (code < 300) return 'text-emerald-400'
  if (code < 400) return 'text-amber-400'
  return 'text-rose-400'
}
