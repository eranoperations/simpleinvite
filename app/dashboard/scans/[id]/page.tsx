'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PROFILES, type ScanDepth } from '@/lib/scanner/profiles'
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  SEVERITY_STYLE,
  formatDuration,
  scoreColor,
  scoreRing,
} from '@/lib/ui'
import type { Category, IFinding, IPageRecord, ScanStatus, Severity } from '@/models/Scan'

interface ScanDetail {
  id: string
  targetUrl: string
  hostname: string
  depth: ScanDepth
  status: ScanStatus
  progress: { current: number; total: number; message: string }
  summary?: string
  score?: number
  findings: IFinding[]
  pages: IPageRecord[]
  stats: {
    pagesCrawled: number
    interactionsTried: number
    consoleErrors: number
    failedRequests: number
    durationMs: number
  }
  aiModel?: string
  aiProvider?: string
  error?: string
  createdAt: string
  finishedAt?: string
}

const ACTIVE: ScanStatus[] = ['queued', 'crawling', 'analyzing']
const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export default function ScanReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [tab, setTab] = useState<'findings' | 'pages'>('findings')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/scans/${id}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setScan(data.scan)
    } catch {
      // Transient failure — the poll will pick it up.
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const running = scan ? ACTIVE.includes(scan.status) : false
  useEffect(() => {
    if (!running) return
    const timer = setInterval(load, 2500)
    return () => clearInterval(timer)
  }, [running, load])

  const counts = useMemo(() => {
    const bySeverity = {} as Record<Severity, number>
    const byCategory = {} as Record<Category, number>
    for (const f of scan?.findings ?? []) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
      byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
    }
    return { bySeverity, byCategory }
  }, [scan?.findings])

  const visible = useMemo(() => {
    return (scan?.findings ?? []).filter(
      (f) =>
        (categoryFilter === 'all' || f.category === categoryFilter) &&
        (severityFilter === 'all' || f.severity === severityFilter),
    )
  }, [scan?.findings, categoryFilter, severityFilter])

  async function onDelete() {
    if (!confirm('Delete this scan and its report? This cannot be undone.')) return
    const res = await fetch(`/api/scans/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/dashboard')
  }

  if (notFound) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-medium text-white">Scan not found</p>
        <p className="mt-1 text-ink-400">It may have been deleted.</p>
        <Link href="/dashboard" className="mt-5 inline-block text-accent-bright hover:text-white">
          ← Back to scans
        </Link>
      </div>
    )
  }

  if (!scan) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl border border-ink-800 bg-ink-900/30" />
        <div className="h-64 animate-pulse rounded-2xl border border-ink-800 bg-ink-900/30" />
      </div>
    )
  }

  const pct =
    scan.progress?.total > 0
      ? Math.min(100, Math.round((scan.progress.current / scan.progress.total) * 100))
      : 0

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-block text-sm text-ink-400 transition hover:text-white">
        ← All scans
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white">
              {scan.hostname}
            </h1>
            <a
              href={scan.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block truncate text-sm text-ink-400 transition hover:text-accent-bright"
            >
              {scan.targetUrl} ↗
            </a>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-ink-800 px-2.5 py-1 text-ink-300">
                {PROFILES[scan.depth]?.label ?? scan.depth}
              </span>
              {scan.aiModel && (
                <span className="rounded-full bg-ink-800 px-2.5 py-1 text-ink-300">
                  {scan.aiProvider} · {scan.aiModel}
                </span>
              )}
              {scan.status === 'complete' && (
                <span className="rounded-full bg-ink-800 px-2.5 py-1 text-ink-300">
                  ran {formatDuration(scan.stats.durationMs)}
                </span>
              )}
            </div>
          </div>

          {scan.status === 'complete' && typeof scan.score === 'number' && (
            <ScoreDial score={scan.score} />
          )}
        </div>

        {running && (
          <div className="mt-6 border-t border-ink-800 pt-5">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="pulse-ring absolute inline-flex h-full w-full text-accent" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-sm font-medium text-white">{scan.progress.message}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${Math.max(pct, 5)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-400">
              {scan.progress.current} of {scan.progress.total} · this page updates itself
            </p>
          </div>
        )}

        {scan.status === 'failed' && (
          <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <p className="text-sm font-medium text-rose-300">Scan failed</p>
            <p className="mt-1 text-sm text-rose-300/80">{scan.error}</p>
          </div>
        )}
      </div>

      {scan.status === 'complete' && (
        <>
          {scan.summary && (
            <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-6 sm:p-7">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
                Assessment
              </h2>
              <p className="leading-relaxed text-ink-200">{scan.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Pages crawled" value={scan.stats.pagesCrawled} />
            <Stat label="Controls clicked" value={scan.stats.interactionsTried} />
            <Stat label="Console errors" value={scan.stats.consoleErrors} />
            <Stat label="Failed requests" value={scan.stats.failedRequests} />
          </div>

          {/* Severity bar */}
          <div className="flex flex-wrap gap-2">
            {SEVERITY_ORDER.filter((s) => counts.bySeverity[s]).map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(severityFilter === s ? 'all' : s)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${SEVERITY_STYLE[s].chip} ${
                  severityFilter === s ? 'ring-2' : ''
                }`}
              >
                {counts.bySeverity[s]} {SEVERITY_STYLE[s].label}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-ink-800">
            {(['findings', 'pages'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition ${
                  tab === t
                    ? 'border-accent text-white'
                    : 'border-transparent text-ink-400 hover:text-ink-200'
                }`}
              >
                {t}
                <span className="ml-1.5 text-xs text-ink-400">
                  {t === 'findings' ? scan.findings.length : scan.pages.length}
                </span>
              </button>
            ))}
          </div>

          {tab === 'findings' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
                  All categories
                </FilterChip>
                {(Object.keys(CATEGORY_LABEL) as Category[])
                  .filter((c) => counts.byCategory[c])
                  .map((c) => (
                    <FilterChip
                      key={c}
                      active={categoryFilter === c}
                      onClick={() => setCategoryFilter(categoryFilter === c ? 'all' : c)}
                    >
                      {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]} ({counts.byCategory[c]})
                    </FilterChip>
                  ))}
              </div>

              {visible.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink-700 py-14 text-center">
                  <div className="text-3xl">{scan.findings.length ? '🔎' : '✨'}</div>
                  <p className="mt-3 font-medium text-ink-200">
                    {scan.findings.length
                      ? 'Nothing matches those filters'
                      : 'No issues found'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {visible.map((f, i) => {
                    const open = expanded.has(i)
                    const style = SEVERITY_STYLE[f.severity]
                    return (
                      <li
                        key={i}
                        className={`overflow-hidden rounded-xl border border-ink-800 border-l-4 bg-ink-900/40 ${style.border}`}
                      >
                        <button
                          onClick={() => {
                            const next = new Set(expanded)
                            open ? next.delete(i) : next.add(i)
                            setExpanded(next)
                          }}
                          className="flex w-full items-start gap-3.5 p-5 text-left transition hover:bg-ink-900/60"
                        >
                          <span className="mt-1 shrink-0 text-lg">{CATEGORY_ICON[f.category]}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                                {style.label}
                              </span>
                              <span className="text-xs text-ink-400">{CATEGORY_LABEL[f.category]}</span>
                              {f.source === 'scanner' && (
                                <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-400">
                                  verified by scanner
                                </span>
                              )}
                            </span>
                            <span className="mt-1.5 block font-medium text-white">{f.title}</span>
                            {!open && (
                              <span className="mt-1 line-clamp-2 block text-sm text-ink-400">
                                {f.description}
                              </span>
                            )}
                          </span>
                          <span className={`shrink-0 text-ink-400 transition ${open ? 'rotate-180' : ''}`}>
                            ▾
                          </span>
                        </button>

                        {open && (
                          <div className="space-y-4 border-t border-ink-800 px-5 py-5 pl-[3.9rem]">
                            <Section title="What's wrong">{f.description}</Section>
                            {f.evidence && (
                              <div>
                                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-400">
                                  Evidence
                                </h4>
                                <pre className="thin-scroll overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-ink-800 bg-ink-950 p-3.5 text-xs leading-relaxed text-ink-300">
                                  {f.evidence}
                                </pre>
                              </div>
                            )}
                            <Section title="Recommendation">{f.recommendation}</Section>
                            {f.affectedUrls.length > 0 && (
                              <div>
                                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-400">
                                  Affected pages
                                </h4>
                                <ul className="space-y-1">
                                  {f.affectedUrls.map((u) => (
                                    <li key={u}>
                                      <a
                                        href={u}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="break-all text-sm text-accent-bright transition hover:text-white"
                                      >
                                        {u}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="thin-scroll overflow-x-auto rounded-xl border border-ink-800">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-ink-900/60 text-left text-xs uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Page</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Load</th>
                    <th className="px-4 py-3 font-medium">Errors</th>
                    <th className="px-4 py-3 font-medium">Clicked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {scan.pages.map((p) => (
                    <tr key={p.url} className="align-top transition hover:bg-ink-900/40">
                      <td className="max-w-sm px-4 py-3">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-ink-200 transition hover:text-accent-bright"
                        >
                          {p.title || p.url}
                        </a>
                        <span className="block truncate text-xs text-ink-400">{p.url}</span>
                        {p.notes.map((n) => (
                          <span key={n} className="mt-1 block text-xs text-amber-400/80">
                            {n}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            p.statusCode >= 400 || p.statusCode === 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          {p.statusCode || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink-300">{p.loadTimeMs}ms</td>
                      <td className="px-4 py-3">
                        {p.consoleErrors.length + p.failedRequests.length > 0 ? (
                          <span className="text-amber-400">
                            {p.consoleErrors.length + p.failedRequests.length}
                          </span>
                        ) : (
                          <span className="text-ink-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-ink-300">{p.interactionsTried}</span>
                        {p.interactionErrors.length > 0 && (
                          <span className="ml-1.5 text-xs text-amber-400">
                            ({p.interactionErrors.length} odd)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="border-t border-ink-800 pt-5">
        <button
          onClick={onDelete}
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-400 transition hover:border-rose-500/40 hover:text-rose-300"
        >
          Delete scan
        </button>
      </div>
    </div>
  )
}

function ScoreDial({ score }: { score: number }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <svg className="absolute -rotate-90" width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} className="fill-none stroke-ink-800" strokeWidth="7" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          className={`fill-none ${scoreRing(score)} transition-[stroke-dashoffset] duration-1000`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="text-center">
        <div className={`text-2xl font-semibold tabular-nums ${scoreColor(score)}`}>{score}</div>
        <div className="text-[10px] uppercase tracking-wider text-ink-400">score</div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-4">
      <div className="text-2xl font-semibold tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-xs text-ink-400">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-400">{title}</h4>
      <p className="leading-relaxed text-ink-200">{children}</p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-accent bg-accent/15 text-white'
          : 'border-ink-700 text-ink-300 hover:border-ink-600 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
