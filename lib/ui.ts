import type { Category, Severity } from '@/models/Scan'

export const SEVERITY_STYLE: Record<Severity, { label: string; chip: string; dot: string; border: string }> = {
  critical: {
    label: 'Critical',
    chip: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
    dot: 'bg-rose-400',
    border: 'border-l-rose-500',
  },
  high: {
    label: 'High',
    chip: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30',
    dot: 'bg-orange-400',
    border: 'border-l-orange-500',
  },
  medium: {
    label: 'Medium',
    chip: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    dot: 'bg-amber-400',
    border: 'border-l-amber-500',
  },
  low: {
    label: 'Low',
    chip: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30',
    dot: 'bg-sky-400',
    border: 'border-l-sky-500',
  },
  info: {
    label: 'Info',
    chip: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30',
    dot: 'bg-slate-400',
    border: 'border-l-slate-500',
  },
}

export const CATEGORY_LABEL: Record<Category, string> = {
  security: 'Security',
  ux: 'UI / UX',
  bug: 'Bugs',
  accessibility: 'Accessibility',
  performance: 'Performance',
  seo: 'SEO',
}

export const CATEGORY_ICON: Record<Category, string> = {
  security: '🔒',
  ux: '🎨',
  bug: '🐞',
  accessibility: '♿',
  performance: '⚡',
  seo: '🔍',
}

export function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-rose-400'
}

export function scoreRing(score: number): string {
  if (score >= 85) return 'stroke-emerald-400'
  if (score >= 65) return 'stroke-amber-400'
  if (score >= 40) return 'stroke-orange-400'
  return 'stroke-rose-400'
}

export function relativeTime(date: string | Date): string {
  const then = new Date(date).getTime()
  const diff = Date.now() - then
  const mins = Math.round(diff / 60_000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

export function formatDuration(ms: number): string {
  if (!ms) return '—'
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${secs % 60}s`
}
