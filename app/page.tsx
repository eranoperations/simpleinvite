import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { PROFILES, DEPTHS } from '@/lib/scanner/profiles'

const CHECKS = [
  {
    icon: '🔒',
    title: 'Security',
    body: 'Security headers, cookie flags, TLS and redirect behaviour, mixed content, exposed config files, and anything the crawl reveals about how the site handles auth and forms.',
  },
  {
    icon: '🎨',
    title: 'UI / UX',
    body: 'Navigation that dead-ends, controls that do nothing, layouts that break on mobile, forms that fight the user, and copy that leaves people guessing.',
  },
  {
    icon: '🐞',
    title: 'Bugs',
    body: 'Console errors, uncaught exceptions, failed network requests, 404s behind links, and buttons that throw when clicked.',
  },
  {
    icon: '♿',
    title: 'Accessibility',
    body: 'Unlabelled inputs, missing alt text, heading structure, tap-target sizes, duplicate DOM ids and missing language attributes.',
  },
  {
    icon: '⚡',
    title: 'Performance',
    body: 'Slow pages, oversized images, third-party script sprawl, and requests that fail or hang during load.',
  },
  {
    icon: '🔍',
    title: 'SEO',
    body: 'Titles and meta descriptions, canonical tags, heading hierarchy, and thin or duplicated content across the pages crawled.',
  },
]

export default async function LandingPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <span className="text-lg">🛡️</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">SiteSentry</span>
        </div>

        <nav className="flex items-center gap-3 text-sm">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-bright"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-ink-300 transition hover:text-white">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-bright"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-6">
        <section className="pt-16 pb-20 text-center sm:pt-24">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3.5 py-1.5 text-xs text-ink-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="pulse-ring absolute inline-flex h-full w-full text-accent" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Bring your own model — Claude, GPT, or any compatible endpoint
          </div>

          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl">
            Hand over a URL.
            <br />
            Get back everything that&apos;s wrong with it.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-300">
            SiteSentry drives a real browser through your site — following every link, clicking
            every button, filling in the gaps a checklist misses — then hands the evidence to an AI
            model that writes up what to fix, in priority order.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={session ? '/dashboard' : '/register'}
              className="rounded-lg bg-accent px-6 py-3 font-medium text-white shadow-lg shadow-accent/20 transition hover:bg-accent-bright"
            >
              {session ? 'Start a scan' : 'Scan your first site'}
            </Link>
            <a
              href="#how"
              className="rounded-lg border border-ink-700 px-6 py-3 font-medium text-ink-200 transition hover:border-ink-600 hover:text-white"
            >
              How it works
            </a>
          </div>
        </section>

        <section id="how" className="border-t border-ink-800 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white">
            Three depths, same engine
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-400">
            Pick how far down you want to go. Every level uses a real headless browser — the
            difference is how much of the site it covers and how hard it pushes.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {DEPTHS.map((depth, i) => {
              const p = PROFILES[depth]
              const featured = depth === 'deep'
              return (
                <div
                  key={depth}
                  className={`relative rounded-2xl border p-6 transition ${
                    featured
                      ? 'border-accent/40 bg-gradient-to-b from-accent/[0.08] to-transparent'
                      : 'border-ink-800 bg-ink-900/40'
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-2.5 right-5 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-white">
                      Most thorough
                    </span>
                  )}
                  <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-400">
                    Level {i + 1}
                  </div>
                  <h3 className="text-xl font-semibold text-white">{p.label}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-300">{p.blurb}</p>

                  <dl className="mt-5 space-y-2 border-t border-ink-800 pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-ink-400">Pages</dt>
                      <dd className="text-ink-200">up to {p.maxPages}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-400">Clicks buttons</dt>
                      <dd className="text-ink-200">{p.interact ? `yes, ${p.maxInteractionsPerPage}/page` : 'no'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-400">Mobile layout</dt>
                      <dd className="text-ink-200">{p.responsiveCheck ? 'yes' : 'no'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-400">Exposed-file probes</dt>
                      <dd className="text-ink-200">{p.exposureProbes ? 'yes' : 'no'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-400">Typical run</dt>
                      <dd className="text-ink-200">{p.estimate}</dd>
                    </div>
                  </dl>
                </div>
              )
            })}
          </div>
        </section>

        <section className="border-t border-ink-800 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white">
            What comes back
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-400">
            Every finding carries the evidence that produced it, the reason it matters, and the
            specific change to make.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-ink-800 bg-ink-900/40 p-5 transition hover:border-ink-700"
              >
                <div className="text-2xl">{c.icon}</div>
                <h3 className="mt-3 font-semibold text-white">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-ink-800 py-20">
          <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Your model, your key
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-300">
              The analysis provider is three environment variables. Point them at Anthropic, at
              OpenAI, or at any gateway that speaks either dialect — no code changes, no vendor
              lock-in, and your API key never leaves your own deployment.
            </p>
            <pre className="thin-scroll mt-6 overflow-x-auto rounded-xl border border-ink-800 bg-ink-950 p-5 text-sm leading-relaxed text-ink-300">
              <code>{`# Claude
AI_API_BASE_URL=https://api.anthropic.com
AI_API_KEY=sk-ant-...
AI_MODEL=claude-opus-5

# ...or GPT — same app, restart and go
AI_API_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o`}</code>
            </pre>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-ink-800 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-ink-400 sm:flex-row">
          <span>SiteSentry — scan sites you own or have permission to test.</span>
          <Link href="/register" className="transition hover:text-white">
            Get started →
          </Link>
        </div>
      </footer>
    </div>
  )
}
