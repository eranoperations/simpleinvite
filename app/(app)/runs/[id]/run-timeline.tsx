'use client'

import { useEffect, useState } from 'react'
import type { RunDto } from '@/lib/api/serialize'
import { formatDuration, formatWhen, STEP_STYLES, statusClass } from '@/lib/ui'

export function RunTimeline({ initialRun }: { initialRun: RunDto }) {
  const [run, setRun] = useState(initialRun)
  const [openStep, setOpenStep] = useState<number | null>(null)

  const live = run.status === 'queued' || run.status === 'running'

  useEffect(() => {
    if (!live) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${run.id}`)
        if (!res.ok) return
        setRun((await res.json()).run)
      } catch {
        // Transient poll failure; the next tick retries.
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [live, run.id])

  async function cancel() {
    await fetch(`/api/runs/${run.id}/cancel`, { method: 'POST' })
  }

  const passed = run.steps.filter((s) => s.status === 'passed' || s.status === 'repaired').length

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{run.scenarioName}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${statusClass(run.status)}`}>
              {run.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatWhen(run.createdAt)}
            {run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ''}
            {run.aiRepairs > 0 && (
              <span className="text-violet-400">
                {' '}
                · {run.aiRepairs} selector{run.aiRepairs === 1 ? '' : 's'} repaired by AI
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            {passed}/{run.steps.length || run.progress.total} steps passed
          </span>
          {live && (
            <button
              onClick={cancel}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-rose-500 hover:text-rose-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {live && (
        <div className="mt-4 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
          {run.progress.message} — step {run.progress.current} of {run.progress.total}
        </div>
      )}
      {run.error && (
        <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {run.error}
        </div>
      )}

      <ol className="mt-8 space-y-2">
        {run.steps.map((step) => {
          const style = STEP_STYLES[step.status] ?? STEP_STYLES.pending
          const open = openStep === step.idx

          return (
            <li
              key={step.idx}
              className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40"
            >
              <button
                onClick={() => setOpenStep(open ? null : step.idx)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-800/40"
              >
                <span className="mt-1.5 flex shrink-0 items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <span className="w-5 text-right text-xs text-slate-600">{step.idx + 1}</span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                      {step.action}
                    </span>
                    <span className="text-sm text-slate-100">{step.description}</span>
                  </span>
                  {step.detail && (
                    <span className={`mt-1 block text-xs ${style.text}`}>{step.detail}</span>
                  )}
                </span>

                <span className="shrink-0 text-right">
                  <span className={`block text-xs ${style.text}`}>{style.label}</span>
                  {step.durationMs > 0 && (
                    <span className="block text-[11px] text-slate-600">
                      {formatDuration(step.durationMs)}
                    </span>
                  )}
                </span>
              </button>

              {open && (
                <div className="border-t border-slate-800 px-4 py-4">
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    {step.url && (
                      <div>
                        <dt className="text-slate-500">URL at this point</dt>
                        <dd className="mt-0.5 break-all text-slate-300">{step.url}</dd>
                      </div>
                    )}
                    {step.selectorUsed && (
                      <div>
                        <dt className="text-slate-500">Element found by</dt>
                        <dd className="mt-0.5 break-all font-mono text-slate-300">
                          {step.selectorUsed}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {step.consoleErrors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500">Console errors during this step</p>
                      <ul className="mt-1 space-y-1">
                        {step.consoleErrors.map((error, i) => (
                          <li
                            key={i}
                            className="break-words rounded bg-slate-950 px-2 py-1 text-[11px] text-rose-300"
                          >
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.screenshotUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={step.screenshotUrl}
                      alt={`Screenshot after step ${step.idx + 1}`}
                      className="mt-3 w-full rounded-lg border border-slate-800"
                    />
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {run.steps.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
          {live ? 'Waiting for the first step…' : 'This run recorded no steps.'}
        </p>
      )}
    </div>
  )
}
