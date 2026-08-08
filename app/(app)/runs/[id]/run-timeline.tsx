'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RunDto } from '@/lib/api/serialize'
import { formatDuration, formatWhen, STEP_STYLES, statusClass } from '@/lib/ui'

interface FixResult {
  category: 'steps' | 'website' | 'unclear'
  diagnosis: string
  suggestion: string
  fixedSourceText: string | null
  usedScreenshots: boolean
}

const CATEGORY_LABEL: Record<FixResult['category'], string> = {
  steps: 'The compiled steps look wrong',
  website: 'The website may not match what the scenario expects',
  unclear: "Couldn't pin down the cause",
}

export function RunTimeline({ initialRun }: { initialRun: RunDto }) {
  const router = useRouter()
  const [run, setRun] = useState(initialRun)
  const [openStep, setOpenStep] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const [fixing, setFixing] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const [fixResult, setFixResult] = useState<FixResult | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)

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

  async function copyOutput() {
    await navigator.clipboard.writeText(formatRunOutput(run))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function fixWithAi() {
    setFixing(true)
    setFixError(null)
    setFixResult(null)
    setApplyMessage(null)
    try {
      const res = await fetch(`/api/runs/${run.id}/fix`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFixError(data.error ?? 'Could not diagnose the run.')
        return
      }
      setFixResult(data as FixResult)
    } catch {
      setFixError('Could not reach the server.')
    } finally {
      setFixing(false)
    }
  }

  async function applyFix(): Promise<boolean> {
    if (!fixResult?.fixedSourceText) return false
    setApplying(true)
    setApplyMessage(null)
    try {
      // The rewritten text is the fix — it stays the one source of truth, so
      // applying it means saving the text and recompiling through the normal
      // pipeline, exactly like a hand edit would.
      const patchRes = await fetch(`/api/scenarios/${run.scenarioId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceText: fixResult.fixedSourceText }),
      })
      if (!patchRes.ok) {
        const data = await patchRes.json().catch(() => ({}))
        setApplyMessage(data.error ?? 'Could not save the rewritten scenario.')
        return false
      }

      const compileRes = await fetch(`/api/scenarios/${run.scenarioId}/compile`, { method: 'POST' })
      const compileData = await compileRes.json().catch(() => ({}))
      if (!compileRes.ok) {
        setApplyMessage(
          `Saved the rewritten scenario, but it could not compile: ${compileData.error ?? 'unknown error'}`,
        )
        return false
      }

      setApplyMessage(
        `Fix applied — the scenario text was updated and recompiled into ${compileData.steps?.length ?? '?'} steps.`,
      )
      return true
    } catch {
      setApplyMessage('Could not reach the server.')
      return false
    } finally {
      setApplying(false)
    }
  }

  async function applyFixAndRerun() {
    const applied = await applyFix()
    if (!applied) return
    const res = await fetch(`/api/scenarios/${run.scenarioId}/run`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) router.push(`/runs/${data.id}`)
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
          <button
            onClick={copyOutput}
            disabled={run.steps.length === 0}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-50"
          >
            {copied ? 'Copied!' : 'Copy output'}
          </button>
          {run.status === 'failed' && (
            <button
              onClick={fixWithAi}
              disabled={fixing}
              className="rounded-lg border border-violet-500/50 px-3 py-1.5 text-sm text-violet-300 hover:border-violet-400 hover:bg-violet-500/10 disabled:opacity-50"
            >
              {fixing ? 'Diagnosing…' : 'Fix with AI'}
            </button>
          )}
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

      {fixError && (
        <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {fixError}
        </div>
      )}

      {fixResult && (
        <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-violet-200">
              {CATEGORY_LABEL[fixResult.category]}
            </h2>
            <span
              className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
              title={
                fixResult.usedScreenshots
                  ? "Looked at the failing step's screenshots, not just the text log"
                  : 'Based on the text log only — no screenshot was available or the model could not use one'
              }
            >
              {fixResult.usedScreenshots ? 'used screenshots' : 'text only'}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-200">{fixResult.diagnosis}</p>
          {fixResult.suggestion && (
            <p className="mt-2 text-sm text-slate-400">
              <span className="text-slate-300">What you could try: </span>
              {fixResult.suggestion}
            </p>
          )}

          {fixResult.fixedSourceText && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Proposed rewrite of the scenario text
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-sans text-sm leading-relaxed text-slate-200">
                {fixResult.fixedSourceText}
              </pre>
              <p className="mt-1.5 text-xs text-slate-500">
                Applying this replaces the scenario&rsquo;s text and recompiles it — nothing runs until
                you run the test again.
              </p>

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={applyFixAndRerun}
                  disabled={applying}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
                >
                  {applying ? 'Applying…' : 'Apply fix and run again'}
                </button>
                <button
                  onClick={applyFix}
                  disabled={applying}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500 disabled:opacity-50"
                >
                  {applying ? 'Applying…' : 'Apply fix only'}
                </button>
                {applyMessage && <span className="text-xs text-slate-400">{applyMessage}</span>}
              </div>
            </div>
          )}
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

function formatRunOutput(run: RunDto): string {
  const lines = [
    `${run.scenarioName} — ${run.status}`,
    `${formatWhen(run.createdAt)}${run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ''}`,
    run.aiRepairs > 0 ? `${run.aiRepairs} selector${run.aiRepairs === 1 ? '' : 's'} repaired by AI` : null,
    run.error ? `Error: ${run.error}` : null,
    '',
    ...run.steps.map((step) => {
      const parts = [`${step.idx + 1}. [${step.status}] ${step.action} — ${step.description}`]
      if (step.detail) parts.push(`   ${step.detail}`)
      if (step.selectorUsed) parts.push(`   selector: ${step.selectorUsed}`)
      if (step.url) parts.push(`   url: ${step.url}`)
      for (const err of step.consoleErrors) parts.push(`   console error: ${err}`)
      return parts.join('\n')
    }),
  ]

  return lines.filter((l): l is string => l !== null).join('\n')
}
