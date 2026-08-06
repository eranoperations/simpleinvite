# SiteSentry

AI-powered website validation. Point it at a URL and it drives a real headless
browser through the site — following links, clicking buttons, filling the
viewport at desktop and mobile widths — then hands everything it observed to an
AI model that writes up what to fix, ranked by severity.

Findings cover **security**, **UI/UX**, **bugs**, **accessibility**,
**performance** and **SEO**.

---

## The model is a config value, not a code path

Which model analyzes a scan is decided entirely by three environment variables:

```bash
AI_API_BASE_URL=https://api.anthropic.com   # or https://api.openai.com/v1
AI_API_KEY=sk-ant-...                       # your key, your account
AI_MODEL=claude-opus-5                      # or gpt-4o, or anything else
```

Change them, restart, and the next scan runs on the new provider. Nothing else
in the codebase needs to know.

Both major wire formats are implemented (`lib/ai/client.ts`): Anthropic's
`/v1/messages` and the OpenAI-compatible `/v1/chat/completions`. The dialect is
inferred from the base URL, so OpenRouter, Together, LiteLLM, vLLM, Azure OpenAI
and similar gateways work without changes. Set `AI_PROVIDER=anthropic|openai`
explicitly when the hostname doesn't reveal which dialect it speaks.

Your API key stays in your own deployment and is never written to the database
or returned by any endpoint.

---

## Three scan depths

| | Quick | Standard | Deep dive |
|---|---|---|---|
| Pages crawled | up to 3 | up to 12 | up to 40 |
| Link depth | 1 | 2 | 4 |
| Clicks interactive elements | — | 8 per page | 25 per page |
| Mobile layout check | — | yes | yes |
| Exposed-file probes | — | yes | yes |
| Per-page AI pass | — | — | yes |
| Typical run | 1–2 min | 5–10 min | 20–40 min |

Defined in `lib/scanner/profiles.ts` — adjust the numbers there to retune.

---

## How a scan works

1. **Validate** the target (`lib/scanner/url-guard.ts`). The URL must resolve to
   a public address; loopback, RFC1918, link-local, CGNAT and IPv6 equivalents
   are refused so the scanner can't be pointed at internal infrastructure.
2. **Crawl** with Playwright (`lib/scanner/crawler.ts`). Breadth-first from the
   entry URL, staying on-origin. Each page is audited in-browser for DOM facts
   (headings, forms, labels, alt text, tap targets, mixed content, overflow),
   while console errors, uncaught exceptions and failed requests are recorded.
   Interactive elements are then clicked one at a time to find controls that
   throw or do nothing.
3. **Probe** deterministically (`lib/scanner/probes.ts`): security headers,
   cookie flags, HTTP→HTTPS redirect behaviour, and GET-only checks for files
   like `/.env` and `/.git/HEAD` that should never be public.
4. **Analyze** (`lib/ai/analyze.ts`). The crawl is compacted into an evidence
   document and sent to the model, which returns findings grounded in that
   evidence. Deep scans add a focused second pass over the noisiest pages.
5. **Merge**. Scanner and AI findings are deduplicated — where both report the
   same issue the verifiable scanner version wins — then sorted by severity.

Because the deterministic probes don't depend on the model, a report still
contains real, verifiable findings even if the AI call degrades.

### Scanning is read-only by design

The crawler skips controls whose labels suggest they mutate data or spend money
(delete, checkout, pay, submit, log out, …), dismisses dialogs, and never
submits forms or sends payloads. Probes are GET-only with no fuzzing. Users must
confirm they own the target before a scan starts.

---

## Getting started

Requires Node 20+ and a MongoDB instance.

```bash
npm install
npx playwright install chromium     # skip if you set CHROMIUM_EXECUTABLE_PATH
cp .env.example .env.local          # then fill it in
npm run dev
```

Open http://localhost:3000, create an account, and start a scan.

Check configuration at any time:

```bash
curl localhost:3000/api/health
```

It reports database connectivity plus the active provider, model and base URL —
never the key.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Database connection string |
| `NEXTAUTH_SECRET` | yes | Session signing key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | yes | Canonical app URL |
| `AI_API_BASE_URL` | yes | Provider endpoint root |
| `AI_API_KEY` | yes | Provider API key |
| `AI_MODEL` | yes | Model identifier |
| `AI_PROVIDER` | no | `anthropic` \| `openai`; inferred from the base URL otherwise |
| `AI_MAX_TOKENS` | no | Response ceiling per analysis (default 8000) |
| `AI_TIMEOUT_MS` | no | Per-request timeout (default 180000) |
| `CHROMIUM_EXECUTABLE_PATH` | no | Use a system Chromium instead of Playwright's download |
| `ALLOW_PRIVATE_SCAN_TARGETS` | no | Permits localhost/private targets. **Development only — this disables the SSRF protection.** |

---

## Layout

```
app/
  page.tsx                    landing page
  login/  register/           credentials auth
  dashboard/                  scan list, new-scan form
    scans/[id]/               live progress + report
  api/
    auth/[...nextauth]/       NextAuth handler
    auth/register/            account creation
    scans/                    create + list scans
    scans/[id]/               fetch + delete a scan
    health/                   config and connectivity check
lib/
  ai/config.ts                the three env vars, resolved
  ai/client.ts                Anthropic + OpenAI wire formats, retries, JSON extraction
  ai/analyze.ts               evidence building, prompting, finding validation
  scanner/profiles.ts         quick / medium / deep definitions
  scanner/url-guard.ts        SSRF protection, crawl-scope rules
  scanner/crawler.ts          Playwright crawl and interaction
  scanner/audit-script.ts     in-browser DOM audit
  scanner/probes.ts           deterministic security checks
  scanner/runner.ts           orchestration and progress reporting
models/                       User, Scan
```

---

## Operational notes

Scans run in-process, detached from the HTTP request that started them, and
report progress by writing to the scan document — the UI polls while a scan is
live. That keeps the deployment to a single service, with two consequences worth
knowing:

- A restart mid-scan orphans it. `reapStaleScans()` marks anything stuck for
  over an hour as failed so it can be re-run.
- Concurrency is capped at one active scan per user to bound browser memory.

Moving to a dedicated queue (BullMQ, or a separate worker process) is the natural
next step if you need scans to survive deploys or run several at once.

---

Only scan sites you own or have explicit permission to test.
