import fs from 'node:fs'
import path from 'node:path'
import type { BrowserContext, Page } from 'playwright'
import { evalInPage } from './browser'
import { EXTRACT_SCRIPT, type PageExtract } from './extract'
import type { CrawlProfile } from './profiles'
import { canonicalize, isCrawlable, isSameSite } from './url-guard'
import type { EdgeKind, NodeKind } from '@/lib/db/types'

export interface CrawledNode {
  canonicalUrl: string
  url: string
  title: string
  statusCode: number
  loadTimeMs: number
  depth: number
  kind: NodeKind
  screenshotPath: string | null
  consoleErrors: string[]
  extract: PageExtract | null
  error: string | null
  /** Where the request actually ended up, when the server redirected. */
  landedUrl: string | null
}

export interface CrawledEdge {
  from: string
  to: string
  kind: EdgeKind
  label: string
  selector: string | null
}

export interface CrawlOutput {
  nodes: CrawledNode[]
  edges: CrawledEdge[]
  durationMs: number
}

export type ProgressFn = (current: number, total: number, message: string) => void

/**
 * Clicking these on a live site changes state, spends money, or ends the
 * session. Their edges are not worth the damage, so they are never clicked —
 * if such a control is also a real link, the `<a href>` pass still maps it.
 */
const DESTRUCTIVE =
  /\b(delete|remove|destroy|cancel|deactivate|unsubscribe|log ?out|sign ?out|buy|purchase|checkout|pay|order|confirm|submit|send|publish|reset|clear|empty|archive|revoke|disconnect|upgrade|downgrade|donate|save|update|create|add|apply|accept|decline)\b/i

export async function crawlSite(
  context: BrowserContext,
  startUrl: string,
  profile: CrawlProfile,
  screenshotDir: string,
  onProgress: ProgressFn = () => {},
  signal?: AbortSignal,
): Promise<CrawlOutput> {
  const started = Date.now()
  const nodes = new Map<string, CrawledNode>()
  const edges: CrawledEdge[] = []
  const seenEdges = new Set<string>()

  const start = canonicalize(startUrl)
  const frontier: { url: string; depth: number }[] = [{ url: start, depth: 0 }]
  const queued = new Set<string>([start])

  if (profile.screenshots) fs.mkdirSync(screenshotDir, { recursive: true })

  const addEdge = (edge: CrawledEdge) => {
    if (edge.from === edge.to) return // self-links add noise, not structure
    const key = `${edge.from}|${edge.to}|${edge.kind}|${edge.label}`
    if (seenEdges.has(key)) return
    seenEdges.add(key)
    edges.push(edge)
  }

  /**
   * Every edge target becomes a node, even one we will never load: that is how
   * the map shows where the site leads once the budget runs out.
   */
  const ensureNode = (url: string, depth: number): CrawledNode => {
    const canonical = canonicalize(url)
    const existing = nodes.get(canonical)
    if (existing) return existing

    const node: CrawledNode = {
      canonicalUrl: canonical,
      url,
      title: '',
      statusCode: 0,
      loadTimeMs: 0,
      depth,
      kind: isSameSite(canonical, start) ? 'unvisited' : 'external',
      screenshotPath: null,
      consoleErrors: [],
      extract: null,
      error: null,
      landedUrl: null,
    }
    nodes.set(canonical, node)
    return node
  }

  /**
   * Moves a redirected page's payload onto the URL that actually served it and
   * links the two with a redirect edge. Returns the node the crawl should treat
   * as "the page" from here on.
   */
  const adoptRedirect = (requested: CrawledNode, depth: number): CrawledNode => {
    const landed = requested.landedUrl ? canonicalize(requested.landedUrl) : null
    if (!landed || landed === requested.canonicalUrl) return requested

    const target = ensureNode(landed, depth)
    target.kind = 'page'
    target.url = requested.landedUrl!
    target.title = requested.title
    target.statusCode = requested.statusCode
    target.loadTimeMs = requested.loadTimeMs
    target.screenshotPath = requested.screenshotPath
    target.consoleErrors = requested.consoleErrors
    target.extract = requested.extract
    target.error = requested.error

    // The requested URL keeps its identity as a node, but owns none of the
    // content — it is a signpost, and the redirect edge says where it points.
    requested.title = ''
    requested.extract = null
    requested.screenshotPath = null
    requested.consoleErrors = []

    addEdge({
      from: requested.canonicalUrl,
      to: landed,
      kind: 'redirect',
      label: 'redirects to',
      selector: null,
    })

    // It has now been crawled, so the frontier must not fetch it a second time.
    queued.add(landed)
    return target
  }

  ensureNode(start, 0)

  let visited = 0
  while (frontier.length && visited < profile.maxPages) {
    if (signal?.aborted) break

    const next = frontier.shift()!
    const canonical = canonicalize(next.url)
    visited++

    onProgress(
      visited,
      Math.min(profile.maxPages, visited + frontier.length),
      `Mapping ${shorten(canonical)}`,
    )

    const requested = ensureNode(canonical, next.depth)
    await visitPage(context, requested, profile, screenshotDir, signal)
    requested.kind = 'page'

    // A redirect means the content belongs to the URL that served it, not the
    // one we asked for. Filing it under the request would put, say, the profile
    // page's links on a node labelled /login.
    const node = adoptRedirect(requested, next.depth)

    if (!node.extract) continue
    const source = node.canonicalUrl

    // 1. Link edges — every <a href>, free of charge.
    for (const link of node.extract.links) {
      const target = canonicalize(link.href)
      if (!/^https?:/i.test(target)) continue

      const targetNode = ensureNode(target, next.depth + 1)
      addEdge({
        from: source,
        to: target,
        kind: 'link',
        label: link.text || shorten(target),
        selector: link.selector,
      })

      if (
        isSameSite(target, start) &&
        isCrawlable(target) &&
        !queued.has(target) &&
        next.depth < profile.maxDepth
      ) {
        queued.add(target)
        frontier.push({ url: target, depth: next.depth + 1 })
        targetNode.depth = Math.min(targetNode.depth, next.depth + 1)
      }
    }

    // 2. Button edges — the ones only a click reveals.
    if (profile.maxClicksPerPage > 0 && !signal?.aborted) {
      const discovered = await probeControls(context, node, profile, signal)
      for (const hit of discovered) {
        const target = canonicalize(hit.url)
        ensureNode(target, next.depth + 1)
        addEdge({
          from: source,
          to: target,
          kind: 'button',
          label: hit.label,
          selector: hit.selector,
        })

        if (
          isSameSite(target, start) &&
          isCrawlable(target) &&
          !queued.has(target) &&
          next.depth < profile.maxDepth
        ) {
          queued.add(target)
          frontier.push({ url: target, depth: next.depth + 1 })
        }
      }
    }

    // Shallow, short paths first — those are the pages that define the site.
    frontier.sort((a, b) => a.depth - b.depth || a.url.length - b.url.length)
  }

  return { nodes: [...nodes.values()], edges, durationMs: Date.now() - started }
}

async function visitPage(
  context: BrowserContext,
  node: CrawledNode,
  profile: CrawlProfile,
  screenshotDir: string,
  signal?: AbortSignal,
): Promise<void> {
  let page: Page | null = null
  try {
    page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error' && node.consoleErrors.length < 20) {
        node.consoleErrors.push(msg.text().slice(0, 300))
      }
    })
    page.on('pageerror', (err) => {
      if (node.consoleErrors.length < 20) {
        node.consoleErrors.push(`Uncaught ${err.message}`.slice(0, 300))
      }
    })
    // An open dialog blocks every later interaction on the page.
    page.on('dialog', (d) => d.dismiss().catch(() => {}))

    const t0 = Date.now()
    const response = await page.goto(node.url, { waitUntil: 'domcontentloaded' })
    node.statusCode = response?.status() ?? 0

    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(profile.settleMs)
    node.loadTimeMs = Date.now() - t0

    // Read after settling: a client-side redirect only shows up once the page
    // has had a chance to run.
    node.landedUrl = page.url()

    node.extract = await evalInPage<PageExtract>(page, EXTRACT_SCRIPT)
    node.title = node.extract.title || node.extract.headings[0] || ''

    if (profile.screenshots && !signal?.aborted) {
      const file = path.join(screenshotDir, `${hash(node.canonicalUrl)}.jpg`)
      await page.screenshot({ path: file, type: 'jpeg', quality: 60 })
      node.screenshotPath = path.basename(file)
    }
  } catch (err) {
    node.error = (err as Error).message.slice(0, 300)
  } finally {
    await page?.close().catch(() => {})
  }
}

interface ControlHit {
  label: string
  selector: string
  url: string
}

/**
 * Clicks the page's non-anchor controls on a throwaway page and records which
 * ones navigate. This is the only way to find a route reachable solely through
 * a JavaScript handler — no amount of href parsing will reveal it.
 */
async function probeControls(
  context: BrowserContext,
  node: CrawledNode,
  profile: CrawlProfile,
  signal?: AbortSignal,
): Promise<ControlHit[]> {
  const hits: ControlHit[] = []
  const candidates = (node.extract?.interactive ?? [])
    .filter((c) => c.text && !DESTRUCTIVE.test(c.text))
    .slice(0, profile.maxClicksPerPage)

  if (!candidates.length) return hits

  let page: Page | null = null
  try {
    page = await context.newPage()
    page.on('dialog', (d) => d.dismiss().catch(() => {}))

    for (const control of candidates) {
      if (signal?.aborted) break

      try {
        // Reload between clicks: the previous click may have mutated the DOM,
        // opened an overlay, or navigated away.
        await page.goto(node.url, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(Math.min(profile.settleMs, 500))

        const locator = page.locator(control.selector).first()
        if (!(await locator.count())) continue

        await locator.click({ timeout: 4000 })
        await page.waitForTimeout(900)

        const landed = page.url()
        if (canonicalize(landed) !== node.canonicalUrl && /^https?:/i.test(landed)) {
          hits.push({ label: control.text, selector: control.selector, url: landed })
        }
      } catch {
        // A control that cannot be clicked (obscured, detached, disabled) simply
        // yields no edge — it is not a crawl failure.
      }
    }
  } catch {
    // Probing is best-effort; link edges are already recorded.
  } finally {
    await page?.close().catch(() => {})
  }

  return hits
}

function hash(value: string): string {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function shorten(url: string): string {
  try {
    const u = new URL(url)
    const short = `${u.hostname}${u.pathname}`
    return short.length > 60 ? `${short.slice(0, 57)}...` : short
  } catch {
    return url.slice(0, 60)
  }
}
