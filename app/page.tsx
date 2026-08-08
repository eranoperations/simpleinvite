import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'

export default async function LandingPage() {
  const user = await getSessionUser()

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">
          AIS<span className="text-sky-400">Centry</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <Link
              href="/maps"
              className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400"
            >
              Open the app
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-slate-300 hover:text-white">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mt-24">
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight">
          See how a website fits together. Then test it in plain English.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-400">
          Point AISCentry at a URL. It drives a real browser through the site and draws every page
          it finds, with each connection labelled by the link or button that makes it. Then describe
          a test the way you would to a colleague — it gets compiled into concrete browser steps and
          executed, screenshot by screenshot.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href={user ? '/maps/new' : '/register'}
            className="rounded-lg bg-sky-500 px-6 py-3 font-medium text-white hover:bg-sky-400"
          >
            {user ? 'Map a site' : 'Get started'}
          </Link>
          {!user && (
            <Link
              href="/login"
              className="rounded-lg border border-slate-700 px-6 py-3 font-medium text-slate-200 hover:border-slate-500"
            >
              I have an account
            </Link>
          )}
        </div>
      </section>

      <section className="mt-28 grid gap-8 md:grid-cols-3">
        <Feature
          title="A map, not a list"
          body="Pages become nodes and every link or button becomes a labelled edge, so a route that
                only exists behind a JavaScript click shows up alongside ordinary navigation."
        />
        <Feature
          title="Tests you can actually read"
          body="“Go to the login page, sign in as demo, open the profile and change the name to Ada.”
                That is the whole test. It compiles once into concrete steps and replays deterministically."
        />
        <Feature
          title="Behind the login, too"
          body="Attach a sign-in scenario to a map and the crawl runs authenticated, so member-only
                pages appear on the graph instead of a wall of redirects."
        />
      </section>

      <footer className="mt-28 border-t border-slate-800 pt-8 text-sm text-slate-500">
        Self-hosted. Your site data and any credentials stay in your own deployment.
      </footer>
    </main>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="font-medium text-slate-100">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  )
}
