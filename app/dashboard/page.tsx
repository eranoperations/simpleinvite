'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { NewScanForm } from './new-scan-form'
import { PROFILES, type ScanDepth } from '@/lib/scanner/profiles'
import { relativeTime, scoreColor } from '@/lib/ui'
import type { ScanStatus } from '@/models/Scan'

interface ScanSummary {
  id: string
  targetUrl: string
  hostname: string
  depth: ScanDepth
  status: ScanStatus
  progress: { current: number; total: number; message: string }
  score?: number
  summary?: string
  findingCount: number
  criticalCount: number
  pagesCrawled: number
  createdAt: string
  error?: string
}

const STATUS_STYLE: Record<ScanStatus, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'bg-slate-500/15 text-slate-300' },
  crawling: { label: 'Crawling', className: 'bg-sky-500/15 text-sky-300' },
  analyzing: { label: 'Analyzing', className: 'bg-violet-500/15 text-violet-300' },
  complete: { label: 'Complete', className: 'bg-emerald-500/15 text-emerald-300' },
  failed: { label: 'Failed', className: 'bg-rose-500/15 text-rose-300' },
}

const ACTIVE: ScanStatus[] = ['queued', 'crawling', 'analyzing']

export default function DashboardPage() {
  const [scans, setScans] = useState<ScanSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scans')
      if (!res.ok) return
      const data = await res.json()
      setScans(data.scans ?? [])
    } catch {
      // A dropped poll is not worth surfacing; the next tick retries.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Poll only while something is actually in flight.
  const hasActive = scans.some((s) => ACTIVE.includes(s.status))
  useEffect(() => {
    if (!hasActive) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [hasActive, load])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Scans</h1>
        <p className="mt-1 text-ink-400">
          Every report keeps its findings, evidence and page list.
        </p>
      </div>

      <NewScanForm onStarted={load} />

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-ink-400">
          History
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-ink-800 bg-ink-900/30" />
            ))}
          </div>
        ) : scans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-700 py-16 text-center">
            <div className="text-3xl">🔭</div>
            <p className="mt-3 font-medium text-ink-200">No scans yet</p>
            <p className="mt-1 text-sm text-ink-400">
              Start one above and the report will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {scans.map((scan) => {
              const status = STATUS_STYLE[scan.status]
              const active = ACTIVE.includes(scan.status)
              const pct =
                scan.progress?.total > 0
                  ? Math.min(100, Math.round((scan.progress.current / scan.progress.total) * 100))
                  : 0

              return (
                <li key={scan.id}>
                  <Link
                    href={`/dashboard/scans/${scan.id}`}
                    className="block rounded-xl border border-ink-800 bg-ink-900/40 p-5 transition hover:border-ink-600 hover:bg-ink-900/70"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="truncate font-medium text-white">{scan.hostname}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-ink-300">
                            {PROFILES[scan.depth]?.label ?? scan.depth}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-sm text-ink-400">{scan.targetUrl}</p>

                        {active ? (
                          <div className="mt-3">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                              <div
                                className="h-full rounded-full bg-accent transition-all duration-500"
                                style={{ width: `${Math.max(pct, 6)}%` }}
                              />
                            </div>
                            <p className="mt-1.5 text-xs text-ink-400">{scan.progress?.message}</p>
                          </div>
                        ) : scan.status === 'failed' ? (
                          <p className="mt-2 line-clamp-2 text-sm text-rose-300/80">{scan.error}</p>
                        ) : (
                          <p className="mt-2 text-sm text-ink-400">
                            {scan.findingCount} findings
                            {scan.criticalCount > 0 && (
                              <span className="text-rose-300"> · {scan.criticalCount} high or critical</span>
                            )}
                            {' · '}
                            {scan.pagesCrawled} pages crawled
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-5">
                        {scan.status === 'complete' && typeof scan.score === 'number' && (
                          <div className="text-right">
                            <div className={`text-2xl font-semibold tabular-nums ${scoreColor(scan.score)}`}>
                              {scan.score}
                            </div>
                            <div className="text-xs text-ink-400">score</div>
                          </div>
                        )}
                        <span className="text-xs text-ink-400">{relativeTime(scan.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
