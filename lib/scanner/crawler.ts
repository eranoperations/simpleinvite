import { chromium, type Browser, type Page, type BrowserContext } from 'playwright'
import { AUDIT_SCRIPT, type PageAudit } from './audit-script'
import type { ScanProfile } from './profiles'
import { canonicalize, isCrawlable, isSameSite } from './url-guard'

export interface CrawledPage {
  url: string
  depth: number
  statusCode: number
  loadTimeMs: number
  redirectedTo?: string
  headers: Record<string, string>
  audit: PageAudit | null
  consoleErrors: string[]
  consoleWarnings: string[]
  failedRequests: string[]
  pageErrors: string[]
  interactions: InteractionResult[]
  mobile?: { horizontalOverflow: boolean; documentWidth: number; viewportWidth: number }
  loadError?: string
}

export interface InteractionResult {
  label: string
  selector: string
  outcome: 'ok' | 'navigated' | 'error' | 'no-effect'
  detail?: string
  consoleErrors: string[]
}

export interface CrawlResult {
  pages: CrawledPage[]
  cookies: { name: string; secure: boolean; httpOnly: boolean; sameSite: string; domain: string }[]
  durationMs: number
}

/** Clicking these would change state on the user's live site. */
const DESTRUCTIVE = /\b(delete|remove|destroy|cancel account|close account|deactivate|unsubscribe|log ?out|sign ?out|buy|purchase|checkout|pay|order now|confirm|submit|send|publish|reset|clear|empty|archive|revoke|disconnect|upgrade|downgrade|donate)\b/i

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const DESKTOP_VIEWPORT = { width: 1440, height: 900 }

export type ProgressFn = (current: number, total: number, message: string) => void

/**
 * Playwright evaluates a string argument as an *expression*, so passing an
 * arrow-function source returns the function itself (which serializes to
 * undefined) instead of calling it. Wrapping it as an IIFE is what actually
 * runs the body and hands back its value.
 */
function evalInPage<T>(page: Page, fnSource: string): Promise<T> {
  return page.evaluate(`(${fnSource})()`) as Promise<T>
}

export async function crawlSite(
  startUrl: string,
  profile: ScanProfile,
  onProgress: ProgressFn = () => {},
  signal?: AbortSignal,
): Promise<CrawlResult> {
  const started = Date.now()
  let browser: Browser | null = null
  const pages: CrawledPage[] = []

  try {
    browser = await chromium.launch({
      headless: true,
      // Container images often ship a system Chromium instead of the build
      // Playwright downloads. CHROMIUM_EXECUTABLE_PATH points at it.
      ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })

    const context = await browser.newContext({
      viewport: DESKTOP_VIEWPORT,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 SiteSentry/1.0 (+website audit bot)',
      ignoreHTTPSErrors: false,
      serviceWorkers: 'block',
    })
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(45_000)

    const visited = new Set<string>()
    const frontier: { url: string; depth: number }[] = [
      { url: canonicalize(startUrl), depth: 0 },
    ]

    while (frontier.length && pages.length < profile.maxPages) {
      if (signal?.aborted) break

      const next = frontier.shift()!
      const url = canonicalize(next.url)
      if (visited.has(url)) continue
      visited.add(url)

      onProgress(
        pages.length + 1,
        Math.min(profile.maxPages, pages.length + frontier.length + 1),
        `Crawling ${shortUrl(url)}`,
      )

      const record = await visitPage(context, url, next.depth, profile, signal)
      pages.push(record)

      // Queue newly discovered same-site links until the budget runs out.
      if (next.depth < profile.maxDepth && record.audit) {
        const candidates = record.audit.links
          .map((l) => canonicalize(l.href))
          .filter((href) => isSameSite(href, startUrl) && isCrawlable(href))

        for (const href of dedupe(candidates)) {
          if (visited.has(href) || frontier.some((f) => f.url === href)) continue
          if (visited.size + frontier.length >= profile.maxPages * 3) break
          frontier.push({ url: href, depth: next.depth + 1 })
        }
        // Shallow, short paths first — they're the pages that matter most.
        frontier.sort((a, b) => a.depth - b.depth || a.url.length - b.url.length)
      }
    }

    const cookies = (await context.cookies()).map((c) => ({
      name: c.name,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: String(c.sameSite ?? 'None'),
      domain: c.domain,
    }))

    await context.close()
    return { pages, cookies, durationMs: Date.now() - started }
  } finally {
    await browser?.close().catch(() => {})
  }
}

async function visitPage(
  context: BrowserContext,
  url: string,
  depth: number,
  profile: ScanProfile,
  signal?: AbortSignal,
): Promise<CrawledPage> {
  const record: CrawledPage = {
    url,
    depth,
    statusCode: 0,
    loadTimeMs: 0,
    headers: {},
    audit: null,
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
    pageErrors: [],
    interactions: [],
  }

  let page: Page | null = null

  try {
    page = await context.newPage()

    page.on('console', (msg) => {
      const text = msg.text().slice(0, 300)
      if (msg.type() === 'error') push(record.consoleErrors, text, 25)
      else if (msg.type() === 'warning') push(record.consoleWarnings, text, 15)
    })
    page.on('pageerror', (err) => push(record.pageErrors, String(err.message).slice(0, 300), 15))
    page.on('requestfailed', (req) => {
      const failure = req.failure()?.errorText ?? 'failed'
      // Blocked trackers are noise, not defects.
      if (failure === 'net::ERR_ABORTED') return
      push(record.failedRequests, `${req.method()} ${shortUrl(req.url())} — ${failure}`, 25)
    })
    page.on('response', (res) => {
      if (res.status() >= 400 && res.request().resourceType() !== 'image') {
        push(record.failedRequests, `${res.status()} ${shortUrl(res.url())}`, 25)
      }
    })
    // A modal dialog would block every later interaction on the page.
    page.on('dialog', (d) => d.dismiss().catch(() => {}))

    const t0 = Date.now()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
    record.statusCode = response?.status() ?? 0
    record.headers = response?.headers() ?? {}
    if (response && canonicalize(response.url()) !== url) {
      record.redirectedTo = response.url()
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(profile.settleMs)
    record.loadTimeMs = Date.now() - t0

    record.audit = await evalInPage<PageAudit>(page, AUDIT_SCRIPT)

    if (profile.responsiveCheck && !signal?.aborted) {
      await page.setViewportSize(MOBILE_VIEWPORT)
      await page.waitForTimeout(700)
      record.mobile = await evalInPage<CrawledPage['mobile']>(
        page,
        `() => ({
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 8,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        })`,
      )
      await page.setViewportSize(DESKTOP_VIEWPORT)
      await page.waitForTimeout(400)
    }

    if (profile.interact && record.audit && !signal?.aborted) {
      record.interactions = await exerciseControls(page, url, record.audit, profile, signal)
    }
  } catch (err) {
    record.loadError = (err as Error).message.slice(0, 300)
  } finally {
    await page?.close().catch(() => {})
  }

  return record
}

/**
 * Clicks the page's interactive elements to surface runtime errors that only
 * appear once a user touches something. Read-only by intent: anything whose
 * label suggests it mutates data or spends money is skipped.
 */
async function exerciseControls(
  page: Page,
  pageUrl: string,
  audit: PageAudit,
  profile: ScanProfile,
  signal?: AbortSignal,
): Promise<InteractionResult[]> {
  const results: InteractionResult[] = []

  const candidates = audit.interactive
    .filter((el) => !DESTRUCTIVE.test(el.text))
    .slice(0, profile.maxInteractionsPerPage)

  for (const el of candidates) {
    if (signal?.aborted) break

    // A handler that throws surfaces as `pageerror`, not `console` — and a
    // button that throws when clicked is precisely what we are hunting for.
    const raised: string[] = []
    const onConsole = (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === 'error') raised.push(msg.text().slice(0, 250))
    }
    const onPageError = (err: Error) => raised.push(`Uncaught ${err.message}`.slice(0, 250))
    page.on('console', onConsole)
    page.on('pageerror', onPageError)

    const result: InteractionResult = {
      label: el.text || `<${el.tag}>`,
      selector: el.selector,
      outcome: 'ok',
      consoleErrors: [],
    }

    try {
      const locator = page.locator(el.selector).first()
      const domBefore = await evalInPage<number>(page, '() => document.body.innerHTML.length').catch(() => 0)

      await locator.click({ timeout: 5000, trial: false })
      await page.waitForTimeout(600)

      if (page.url() !== pageUrl) {
        result.outcome = 'navigated'
        result.detail = `went to ${shortUrl(page.url())}`
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
        await page.waitForTimeout(500)
      } else {
        const domAfter = await evalInPage<number>(page, '() => document.body.innerHTML.length').catch(() => 0)
        // No navigation and no DOM change usually means a dead control.
        if (Math.abs(Number(domAfter) - Number(domBefore)) < 10) {
          result.outcome = 'no-effect'
          result.detail = 'click produced no visible DOM change'
        }
      }
    } catch (err) {
      const message = (err as Error).message
      result.outcome = 'error'
      result.detail = message.includes('Timeout')
        ? 'element could not be clicked (obscured, disabled, or detached)'
        : message.slice(0, 200)
    } finally {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      result.consoleErrors = raised.slice(0, 5)
      // An exception during the click outranks "nothing visibly happened".
      if (raised.length && result.outcome !== 'navigated') {
        result.outcome = 'error'
        result.detail = `threw on click: ${raised[0]}`
      }
      results.push(result)
    }

    // A stray overlay from the previous click blocks everything after it.
    await page.keyboard.press('Escape').catch(() => {})
  }

  return results
}

function push(arr: string[], value: string, cap: number) {
  if (arr.length < cap && !arr.includes(value)) arr.push(value)
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)]
}

function shortUrl(url: string): string {
  return url.length > 90 ? `${url.slice(0, 87)}...` : url
}
