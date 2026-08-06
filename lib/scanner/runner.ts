import { connectDB } from '@/lib/mongodb'
import { Scan, type IFinding } from '@/models/Scan'
import { getAiConfig } from '@/lib/ai/config'
import { analyzePagesInDetail, analyzeSite, dedupeFindings, scoreFromFindings } from '@/lib/ai/analyze'
import { crawlSite } from './crawler'
import { getProfile } from './profiles'
import { runCookieProbes, runExposureProbes, runHeaderProbes, runTransportProbes } from './probes'

/**
 * Scans run in-process, detached from the request that created them, and report
 * progress by writing to the scan document. That keeps the deployment to a
 * single service; the tradeoff is that a restart mid-scan orphans it, which
 * `reapStaleScans` cleans up.
 */

const running = new Map<string, AbortController>()

export function cancelScan(scanId: string): boolean {
  const controller = running.get(scanId)
  if (!controller) return false
  controller.abort()
  return true
}

export function isScanRunning(scanId: string): boolean {
  return running.has(scanId)
}

async function setProgress(scanId: string, current: number, total: number, message: string) {
  await Scan.findByIdAndUpdate(scanId, {
    progress: { current, total, message },
  }).catch(() => {})
}

export async function runScan(scanId: string): Promise<void> {
  const controller = new AbortController()
  running.set(scanId, controller)
  const startedAt = Date.now()

  try {
    await connectDB()
    const scan = await Scan.findById(scanId)
    if (!scan) return

    const profile = getProfile(scan.depth)
    const aiConfig = getAiConfig()

    scan.status = 'crawling'
    scan.startedAt = new Date()
    scan.aiProvider = aiConfig.provider
    scan.aiModel = aiConfig.model
    scan.progress = { current: 0, total: profile.maxPages, message: 'Starting browser' }
    await scan.save()

    // 1. Crawl.
    const crawl = await crawlSite(
      scan.targetUrl,
      profile,
      (current, total, message) => {
        void setProgress(scanId, current, total, message)
      },
      controller.signal,
    )

    if (controller.signal.aborted) throw new Error('Scan cancelled')

    if (!crawl.pages.length || crawl.pages.every((p) => p.statusCode === 0)) {
      throw new Error(
        `Could not load ${scan.targetUrl}. The site may be down, blocking automated browsers, or behind a login.`,
      )
    }

    await Scan.findByIdAndUpdate(scanId, {
      status: 'analyzing',
      pages: crawl.pages.map((p) => ({
        url: p.url,
        title: p.audit?.title ?? '',
        statusCode: p.statusCode,
        loadTimeMs: p.loadTimeMs,
        depth: p.depth,
        consoleErrors: p.consoleErrors,
        failedRequests: p.failedRequests,
        interactionsTried: p.interactions.length,
        interactionErrors: p.interactions
          .filter((i) => i.outcome === 'error' || i.outcome === 'no-effect')
          .map((i) => `"${i.label}" → ${i.outcome}${i.detail ? `: ${i.detail}` : ''}`),
        notes: [
          p.loadError && `Load error: ${p.loadError}`,
          p.redirectedTo && `Redirected to ${p.redirectedTo}`,
          p.mobile?.horizontalOverflow && 'Horizontal overflow on mobile viewport',
        ].filter(Boolean) as string[],
      })),
      progress: { current: crawl.pages.length, total: crawl.pages.length, message: 'Running security probes' },
    })

    // 2. Deterministic probes — cheap, verifiable, independent of the model.
    const origin = new URL(scan.targetUrl).origin
    const scannerFindings: IFinding[] = [
      ...runHeaderProbes(crawl.pages),
      ...runCookieProbes(crawl.cookies, origin.startsWith('https://')),
      ...(await runTransportProbes(origin)),
      ...(profile.exposureProbes ? await runExposureProbes(origin) : []),
    ]

    if (controller.signal.aborted) throw new Error('Scan cancelled')

    // 3. AI review.
    await setProgress(scanId, crawl.pages.length, crawl.pages.length, `Analyzing with ${aiConfig.model}`)
    const analysis = await analyzeSite(scan.targetUrl, crawl, profile, controller.signal)

    let aiFindings = analysis.findings
    if (profile.perPageAnalysis && !controller.signal.aborted) {
      await setProgress(scanId, crawl.pages.length, crawl.pages.length, 'Deep-diving the noisiest pages')
      aiFindings = [...aiFindings, ...(await analyzePagesInDetail(crawl, profile, controller.signal))]
    }

    const findings = dedupeFindings([...scannerFindings, ...aiFindings])

    // The model scores what it saw; the probes it never saw must still count.
    const score = Math.min(analysis.score, scoreFromFindings(findings))

    await Scan.findByIdAndUpdate(scanId, {
      status: 'complete',
      summary: analysis.summary,
      score,
      findings,
      stats: {
        pagesCrawled: crawl.pages.length,
        interactionsTried: crawl.pages.reduce((n, p) => n + p.interactions.length, 0),
        consoleErrors: crawl.pages.reduce((n, p) => n + p.consoleErrors.length + p.pageErrors.length, 0),
        failedRequests: crawl.pages.reduce((n, p) => n + p.failedRequests.length, 0),
        durationMs: Date.now() - startedAt,
      },
      progress: { current: crawl.pages.length, total: crawl.pages.length, message: 'Complete' },
      finishedAt: new Date(),
    })
  } catch (err) {
    const message = (err as Error).message || 'Scan failed'
    console.error(`[scan ${scanId}] failed:`, message)
    await Scan.findByIdAndUpdate(scanId, {
      status: 'failed',
      error: message.slice(0, 500),
      finishedAt: new Date(),
      'stats.durationMs': Date.now() - startedAt,
      progress: { current: 0, total: 0, message: 'Failed' },
    }).catch(() => {})
  } finally {
    running.delete(scanId)
  }
}

/** Fire-and-forget launcher: the HTTP request that starts a scan returns immediately. */
export function launchScan(scanId: string): void {
  void runScan(scanId).catch((err) => {
    console.error(`[scan ${scanId}] unhandled:`, err)
  })
}

/**
 * A process restart leaves scans stuck in `crawling`/`analyzing` forever.
 * Anything running far past the longest plausible scan is marked failed.
 */
export async function reapStaleScans(): Promise<number> {
  await connectDB()
  const cutoff = new Date(Date.now() - 60 * 60 * 1000)
  const stale = await Scan.find({
    status: { $in: ['queued', 'crawling', 'analyzing'] },
    updatedAt: { $lt: cutoff },
  }).select('_id')

  const orphans = stale.filter((s) => !running.has(String(s._id)))
  if (!orphans.length) return 0

  await Scan.updateMany(
    { _id: { $in: orphans.map((s) => s._id) } },
    {
      status: 'failed',
      error: 'Scan was interrupted, most likely by a server restart. Run it again.',
      finishedAt: new Date(),
    },
  )
  return orphans.length
}
