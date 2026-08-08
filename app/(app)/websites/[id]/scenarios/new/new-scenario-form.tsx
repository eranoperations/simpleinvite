'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EXAMPLE = `Go to the login page.
Enter demo@example.com as the email and demo1234 as the password, then sign in.
Open the profile page.
Change the account name to Ada and save.
Check that the page now shows Ada.`

export function NewScenarioForm({ websiteId }: { websiteId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [stepDelay, setStepDelay] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/websites/${websiteId}/scenarios`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          sourceText,
          stepDelayMs: Math.max(0, Math.min(30_000, Math.round(stepDelay * 1000))),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Could not save the scenario.')
        return
      }
      router.push(`/websites/${websiteId}/scenarios/${data.id}`)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sign in and rename the account"
          className={INPUT}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">Wait between steps (seconds)</span>
        <input
          type="number"
          min={0}
          max={30}
          step={0.5}
          value={stepDelay}
          onChange={(e) => setStepDelay(Number(e.target.value))}
          className={INPUT}
        />
        <p className="mt-1 text-xs text-slate-500">
          A pause after each step gives the page time to settle. Change it later from the
          scenario page.
        </p>
      </label>

      <label className="block">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm text-slate-300">The test, in plain English</span>
          <button
            type="button"
            onClick={() => setSourceText(EXAMPLE)}
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            Use an example
          </button>
        </div>
        <textarea
          required
          rows={10}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder={EXAMPLE}
          className={`${INPUT} font-mono text-sm leading-relaxed`}
        />
      </label>

      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Any credentials you type here are stored as written and are sent to the AI model when the
        scenario is compiled. Use a dedicated test account, not a real one.
      </p>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save scenario'}
      </button>
    </form>
  )
}

const INPUT =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 ' +
  'outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
