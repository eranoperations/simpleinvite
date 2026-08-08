# AISCentry

Add a **website** — a URL and a name. Everything else hangs off it: one
persistent **map**, its own test **scenarios**, and its own saved **test
users**. Map the site and a real browser draws a graph of every page it finds,
each connection labelled by the link or button that leads there. Then describe
a test in plain English — *"go to the login page, sign in as demo, open the
profile and change the name to Ada"* — and watch it execute, screenshot by
screenshot.

An account is required. Websites — and everything under them — belong to the
account that created them and are not visible to anyone else.

---

## One website, one map

A website gets its map the moment it's created — empty at first, filled in by
clicking **Start mapping**. There is deliberately no "new map" flow that spins
up a second, disconnected snapshot: **Update map** on the Map tab re-crawls
into that same map, and **Clear map** wipes it back to empty without losing
the website or its sign-in settings. The map is a live picture of the site,
not a point-in-time report.

Scenarios and test users belong to the website the same way — created under
it, scoped to it, gone if it's deleted. A scenario compiles against its own
website's map (real URLs, real field names) with no map to pick, because
there's only ever the one.

## Two features that feed each other

The crawl produces an inventory of the site: every page, every form field with
its label and name, every button caption. The scenario compiler receives that
inventory, which is why *"go to the login page"* becomes the site's real login
URL and *"enter the username"* resolves to the real field — rather than a guess
at what the markup probably looks like.

It feeds back the other way too: every scenario run folds the pages it
actually visited into its website's map — a dashboard reached only after
signing in, a settings page behind a click a crawler would never try. New
pages appear as nodes; the connecting edges are dashed emerald and labelled
with the step that reached them, so it's clear they came from a scenario run
rather than the crawl. This happens even on a failed or cancelled run —
whatever was reached before the failure is still real, and it is added to the
same one map rather than creating a new one. Nothing is ever removed this way;
**Update map** (a full recrawl) or **Clear map** are the only ways a map sheds
pages that no longer exist.

---

## The map

Pages become nodes carrying a screenshot thumbnail; connections become labelled
edges.

- **Solid grey** — an ordinary `<a href>`, labelled with the link text.
- **Dashed violet** — a route found by *clicking*. The crawler clicks
  non-destructive controls and records the ones that navigate, which is the only
  way to find a page reachable solely through a JavaScript handler. No amount of
  href parsing will reveal it.
- **Dotted amber** — a redirect. The content is filed under the URL that served
  it, not the one requested, so a node labelled `/login` never secretly holds
  the profile page.
- **Dashed emerald** — a page a scenario run walked onto, labelled with the
  step that got there. See below.

Controls whose label suggests they mutate data or spend money (`delete`,
`checkout`, `pay`, `submit`, `log out`, …) are never clicked. The crawl is
read-only by intent.

A header linking every page to every other page turns a map into a hairball, so
**Collapse site-wide nav** is on by default: targets reachable from most pages
keep a single edge from the entry page and drop the rest. Turn it off to see
every connection.

### Behind a login

Pick a compiled sign-in scenario, or a saved **test user**, from the Map tab
before clicking Start mapping (or Update map). It runs first, in the same
browser context, and the crawl continues in that signed-in session — so
member-only pages appear on the graph. If the sign-in fails the crawl fails
loudly, rather than quietly mapping the logged-out site.

A test user (managed under the website's **Test users** tab) is a saved
email/username and password, with an optional login page path (`/login` by
default). No scenario or AI compilation is needed: the crawler goes to the
login page, fills the email/username and password fields using common
patterns (`type="email"`, `type="password"`, `name`/`id` containing "email" or
"user", `autocomplete` hints), and submits with Enter. It's the fast path for
an ordinary login form; a compiled scenario is still the answer for anything
more specific — 2FA prompts, multi-step sign-in, or a form that doesn't match
those patterns.

---

## Scenarios: how execution actually works

Running a test is **deterministic and free**. AI is involved at exactly two
points, both optional.

**1. Compile (once, uses AI).** Your text becomes a JSON array of typed steps —
`goto`, `click`, `fill`, `select`, `press`, `waitFor`, `assertText`,
`assertUrl`, `screenshot`. The result is validated against a zod schema before
it is stored: model output is a trust boundary, and there is deliberately no
"run arbitrary JavaScript" step. You review the compiled steps before anything
runs.

You can skip AI entirely by POSTing steps directly to
`/api/scenarios/:id/compile` — the same schema, the same executor.

**2. Run (no AI).** Each step's target description is resolved against the live
page by a fixed ladder — compiled selector, test id, label, placeholder, name,
role, aria-label, exact text, partial text. First strategy that matches one
visible element wins. The run timeline shows which rung found each element.

**3. Repair (only on failure, uses AI).** If every rung misses, the model is
shown the page's actual elements and asked which one the step meant. It can only
return a selector from that list. On success the step is marked *repaired*, and
the selector is **written back into the scenario** — so the next run resolves it
deterministically and never pays for AI again. Set `DISABLE_AI_REPAIR=true` to
turn this off; with no `AI_API_KEY` set at all, a compiled scenario still runs
normally.

A run stops at the first failed step and marks the rest skipped — continuing
past a failed login produces a cascade of misleading errors rather than one
clear cause.

### Credentials

Scenario text is stored as you type it, so any password in it sits in the
database in plaintext and is sent to the model during compilation. It is masked
in the UI, in step records and in logs, but that is presentation only. **Use a
dedicated test account.**

---

## Running it

```bash
npm install
cp .env.example .env.local     # AI_API_KEY only needed for compilation
npm run build && npm start     # or: npm run dev
```

Requires Node 20+. Playwright needs a Chromium; `npx playwright install
chromium` if the app reports it cannot launch one. Data (SQLite + screenshots)
lands in `./.data` — point `AISCENTRY_DATA_DIR` at a persistent volume in a
deployment.

### Verifying it works

A self-contained fixture site exercises both features end to end:

```bash
npm run smoke
```

It starts the fixture and the app on their own ports and a throwaway database,
then asserts on real results: the auth gate rejects signed-out requests, a crawl
finds the JavaScript-only `/deals` route by clicking, a scenario signs in and
renames an account (checked against the fixture's own state, not just a green
tick), passwords stay out of the run record, an authenticated crawl reaches
`/profile` where a signed-out one cannot, and one account cannot read another's
maps or screenshots. Exits non-zero on any failure.

> `scripts/smoke.mjs` still drives the pre-website flat API (`POST /api/maps`,
> `POST /api/scenarios`, …) and needs updating to create a website first and
> call the routes under `/api/websites/:id/...` described below — it has not
> been rewritten for this restructuring yet.

The fixture (`fixtures/demo-site` via `fixtures/serve.mjs`) is deliberately
built with the awkward cases: a button that navigates with no `<a href>`, a
login form with a session cookie, and a profile page that only exists when
signed in.

---

## Architecture

| Path | What lives there |
|---|---|
| `lib/crawl/` | SSRF guard, in-page extraction script, BFS crawler, browser launch |
| `lib/scenario/` | Step schema, compiler, resolver ladder, AI repair, executor, map sync |
| `lib/jobs/` | Detached job runner, progress writes, concurrency cap, stale reaper |
| `lib/db/` | SQLite connection and schema migrations |
| `app/(app)/websites/` | Signed-in UI — website list, and per-website Map / Scenarios / Test users / Settings tabs |
| `app/api/websites/` | Website CRUD, and the map (crawl/cancel/clear) and scenario/test-user creation endpoints, all scoped by website |

Maps and runs execute **in-process, detached** from the request that created
them, writing progress to SQLite while the client polls. That keeps the
deployment to a single service; the cost is that a restart orphans in-flight
jobs, which a reaper marks failed after an hour.

Screenshots are stored outside `public/` and served through an authenticated
route that checks ownership — they can contain a signed-in view of someone's
site.

**Model choice is a config value, not a code path.** `AI_API_BASE_URL`,
`AI_API_KEY` and `AI_MODEL` decide everything; both the Anthropic `/v1/messages`
and OpenAI `/v1/chat/completions` wire formats are implemented, and the dialect
is inferred from the base URL. Your key stays in your deployment and is never
written to the database or returned by any endpoint.

---

## Limits worth knowing

- The crawler clicks controls one at a time, reloading between clicks, so a
  deep crawl of a large site is slow. Budgets are in `lib/crawl/profiles.ts`.
- Only same-origin pages are crawled; off-site links appear as external nodes.
- Scenario steps address one page at a time — there is no multi-tab or
  multi-window support.
- SQLite means a single writer. Fine for one team; not built for a large
  multi-tenant deployment.
