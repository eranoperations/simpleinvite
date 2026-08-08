'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ScenarioDto } from '@/lib/api/serialize'
import { formatDuration, formatWhen } from '@/lib/ui'

interface RunSummary {
  id: string
  status: string
  createdAt: number
  durationMs: number
  aiRepairs: number
  error: string | null
}

interface CompiledStep {
  action: string
  description?: string
  target?: string
  value?: string
  url?: string
  text?: string
  contains?: string
  key?: string
  secret?: boolean
  selector?: string
}

export function ScenarioEditor({
  scenario,
  runs,
  aiConfigured,
}: {
  scenario: ScenarioDto
  runs: RunSummary[]
  aiConfigured: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState(scenario.sourceText)
  const [steps, setSteps] = useState<CompiledStep[] | null>(
    (scenario.steps as CompiledStep[] | null) ?? null,
  )
  const [error, setError] = useState<string | null>(scenario.compileError)
  const [busy, setBusy] = useState<'save' | 'compile' | 'run' | null>(null)
  const [stepDelay, setStepDelay] = useState(scenario.stepDelayMs / 1000)
  const [savingDelay, setSavingDelay] = useState(false)

  const dirty = text !== scenario.sourceText

  async function save() {
    setBusy('save')
    setError(null)
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceText: text }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? 'Could not save.')
        return
      }
      // The API drops compiled steps whenever the text changes, so the preview
      // must not keep showing steps that no longer match what is written.
      setSteps(null)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function compile() {
    setBusy('compile')
    setError(null)
    try {
      if (dirty) await save()
      const res = await fetch(`/api/scenarios/${scenario.id}/compile`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not compile.')
        return
      }
      setSteps(data.steps)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function saveDelay() {
    const ms = Math.max(0, Math.min(30_000, Math.round(stepDelay * 1000)))
    if (ms === scenario.stepDelayMs) return
    setSavingDelay(true)
    try {
      await fetch(`/api/scenarios/${scenario.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stepDelayMs: ms }),
      })
      router.refresh()
    } finally {
      setSavingDelay(false)
    }
  }

  async function run() {
    setBusy('run')
    setError(null)
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}/run`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not start the run.')
        return
      }
      router.push(`/runs/${data.id}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{scenario.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{scenario.targetUrl}</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Wait between steps
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={stepDelay}
              onChange={(e) => setStepDelay(Number(e.target.value))}
              onBlur={saveDelay}
              disabled={savingDelay}
              className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-right text-slate-100 outline-none focus:border-sky-500"
            />
            sec
          </label>
          <div className="flex gap-2">
            <button
              onClick={compile}
              disabled={busy !== null}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500 disabled:opacity-50"
            >
              {busy === 'compile' ? 'Compiling…' : steps ? 'Recompile' : 'Compile'}
            </button>
            <button
              onClick={run}
              disabled={busy !== null || !steps || dirty}
              title={dirty ? 'Save and compile your changes first' : undefined}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {busy === 'run' ? 'Starting…' : 'Run test'}
            </button>
          </div>
        </div>
      </div>

      {!aiConfigured && !steps && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          No AI provider is configured, so plain-English compilation is unavailable. Set{' '}
          <code className="text-amber-100">AI_API_KEY</code> to compile — once a scenario has steps,
          running it needs no AI at all.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">The test</h2>
            {dirty && (
              <button
                onClick={save}
                disabled={busy !== null}
                className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
              >
                {busy === 'save' ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
          <textarea
            rows={16}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm leading-relaxed text-slate-100 outline-none focus:border-sky-500"
          />
          {dirty && (
            <p className="mt-2 text-xs text-amber-400">
              Unsaved changes. Compiling will save them first.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-300">
            Compiled steps{steps ? ` (${steps.length})` : ''}
          </h2>

          {error && (
            <p className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          {steps ? (
            <ol className="space-y-1.5">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                >
                  <span className="w-5 shrink-0 text-right text-xs text-slate-600">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
                        {step.action}
                      </span>
                      <span className="truncate text-xs text-slate-200">{summarize(step)}</span>
                    </div>
                    {step.description && (
                      <p className="mt-1 text-[11px] italic text-slate-500">
                        &ldquo;{step.description}&rdquo;
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
              Not compiled yet. Compiling turns the text into concrete browser steps you can review
              before anything runs.
            </p>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">No runs yet.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/runs/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-slate-600"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        r.status === 'complete'
                          ? 'bg-emerald-400'
                          : r.status === 'failed'
                            ? 'bg-rose-400'
                            : r.status === 'running'
                              ? 'bg-sky-400'
                              : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-sm capitalize text-slate-200">{r.status}</span>
                    {r.aiRepairs > 0 && (
                      <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">
                        {r.aiRepairs} AI repair{r.aiRepairs === 1 ? '' : 's'}
                      </span>
                    )}
                    {r.error && (
                      <span className="truncate text-xs text-rose-400">{r.error}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatWhen(r.createdAt)} · {formatDuration(r.durationMs)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function summarize(step: CompiledStep): string {
  switch (step.action) {
    case 'goto':
      return step.url ?? ''
    case 'click':
      return `"${step.target}"`
    case 'fill':
      return `"${step.target}" ← ${step.secret ? '••••••••' : step.value}`
    case 'select':
      return `"${step.target}" ← ${step.value}`
    case 'press':
      return step.key ?? ''
    case 'waitFor':
      return step.text ? `"${step.text}"` : 'a moment'
    case 'assertText':
      return `"${step.text}"`
    case 'assertUrl':
      return `url contains "${step.contains}"`
    default:
      return step.description ?? ''
  }
}
