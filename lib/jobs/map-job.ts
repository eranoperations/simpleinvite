import path from 'node:path'
import { getDb, newId, now, SCREENSHOT_DIR } from '@/lib/db'
import type { MapRow, ScenarioRow } from '@/lib/db/types'
import { launchBrowser, newContext } from '@/lib/crawl/browser'
import { crawlSite } from '@/lib/crawl/crawler'
import { getProfile } from '@/lib/crawl/profiles'
import { executeSteps } from '@/lib/scenario/executor'
import { parseStepsJson } from '@/lib/scenario/steps'
import { acquireSlot, register, releaseSlot, unregister } from './registry'

function setProgress(mapId: string, current: number, total: number, message: string): void {
  getDb()
    .prepare(
      'UPDATE maps SET progress_current = ?, progress_total = ?, progress_message = ? WHERE id = ?',
    )
    .run(current, total, message, mapId)
}

export async function runMapJob(mapId: string): Promise<void> {
  const db = getDb()
  const controller = register(mapId)
  const startedAt = now()

  try {
    const map = db.prepare('SELECT * FROM maps WHERE id = ?').get(mapId) as MapRow | undefined
    if (!map) return

    db.prepare(
      "UPDATE maps SET status = 'running', started_at = ?, progress_message = 'Waiting for a browser' WHERE id = ?",
    ).run(startedAt, mapId)

    await acquireSlot()
    try {
      const profile = getProfile(map.depth_profile)
      const screenshotDir = path.join(SCREENSHOT_DIR, 'maps', mapId)

      setProgress(mapId, 0, profile.maxPages, 'Starting browser')
      const browser = await launchBrowser()

      try {
        const context = await newContext(browser)

        // An authenticated map logs in first and crawls in the same context, so
        // cookies and storage carry into every page visit.
        if (map.login_scenario_id) {
          setProgress(mapId, 0, profile.maxPages, 'Signing in to the site')
          const scenario = db
            .prepare('SELECT * FROM scenarios WHERE id = ?')
            .get(map.login_scenario_id) as ScenarioRow | undefined
          const steps = parseStepsJson(scenario?.compiled_json ?? null)

          if (!scenario || !steps) {
            throw new Error(
              'The sign-in scenario has not been compiled yet. Open it, compile it, and run this map again.',
            )
          }

          const login = await executeSteps(context, {
            steps,
            baseUrl: map.target_url,
            screenshotDir: path.join(screenshotDir, 'login'),
            onStep: () => {},
            onProgress: (_c, _t, message) => setProgress(mapId, 0, profile.maxPages, `Sign-in: ${message}`),
            signal: controller.signal,
          })

          if (login.failed) {
            const failedStep = login.outcomes.find((o) => o.status === 'failed')
            throw new Error(
              `Sign-in failed, so the map would only show public pages. ${failedStep?.description ?? ''} — ${failedStep?.detail ?? ''}`.trim(),
            )
          }
        }

        const result = await crawlSite(
          context,
          map.target_url,
          profile,
          screenshotDir,
          (current, total, message) => setProgress(mapId, current, total, message),
          controller.signal,
        )

        if (controller.signal.aborted) throw new CancelledError()
        if (!result.nodes.some((n) => n.kind === 'page' && n.statusCode > 0)) {
          throw new Error(
            `Could not load ${map.target_url}. The site may be down, blocking automated browsers, or behind a login.`,
          )
        }

        persist(mapId, result)

        const pages = result.nodes.filter((n) => n.kind === 'page').length
        db.prepare(
          `UPDATE maps SET status = 'complete', finished_at = ?, progress_current = ?,
             progress_total = ?, progress_message = 'Complete', stats_json = ?
           WHERE id = ?`,
        ).run(
          now(),
          pages,
          pages,
          JSON.stringify({
            pages,
            nodes: result.nodes.length,
            edges: result.edges.length,
            linkEdges: result.edges.filter((e) => e.kind === 'link').length,
            buttonEdges: result.edges.filter((e) => e.kind === 'button').length,
            durationMs: now() - startedAt,
          }),
          mapId,
        )
      } finally {
        await browser.close().catch(() => {})
      }
    } finally {
      releaseSlot()
    }
  } catch (err) {
    const cancelled = err instanceof CancelledError || controller.signal.aborted
    db.prepare(
      `UPDATE maps SET status = ?, error = ?, finished_at = ?, progress_message = ? WHERE id = ?`,
    ).run(
      cancelled ? 'cancelled' : 'failed',
      cancelled ? null : ((err as Error).message || 'Mapping failed').slice(0, 500),
      now(),
      cancelled ? 'Cancelled' : 'Failed',
      mapId,
    )
  } finally {
    unregister(mapId)
  }
}

/**
 * Written in one transaction so a polling reader never sees edges pointing at
 * nodes that do not exist yet.
 */
function persist(mapId: string, result: Awaited<ReturnType<typeof crawlSite>>): void {
  const db = getDb()
  const ids = new Map<string, string>()

  const insertNode = db.prepare(
    `INSERT INTO map_nodes
       (id, map_id, url, canonical_url, title, status_code, load_time_ms, depth, kind,
        screenshot_path, console_errors_json, forms_json, interactive_json, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertEdge = db.prepare(
    `INSERT OR IGNORE INTO map_edges (id, map_id, from_node_id, to_node_id, kind, label, selector)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    db.prepare('DELETE FROM map_nodes WHERE map_id = ?').run(mapId)
    db.prepare('DELETE FROM map_edges WHERE map_id = ?').run(mapId)

    for (const node of result.nodes) {
      const id = newId()
      ids.set(node.canonicalUrl, id)
      insertNode.run(
        id,
        mapId,
        node.url,
        node.canonicalUrl,
        node.title,
        node.statusCode,
        node.loadTimeMs,
        node.depth,
        node.kind,
        node.screenshotPath,
        JSON.stringify(node.consoleErrors),
        node.extract ? JSON.stringify(node.extract.forms) : null,
        node.extract ? JSON.stringify(node.extract.interactive) : null,
        node.error,
      )
    }

    for (const edge of result.edges) {
      const from = ids.get(edge.from)
      const to = ids.get(edge.to)
      if (!from || !to) continue
      insertEdge.run(newId(), mapId, from, to, edge.kind, edge.label.slice(0, 120), edge.selector)
    }
  })()
}

class CancelledError extends Error {}

/** Fire-and-forget: the request that starts a map returns immediately. */
export function launchMapJob(mapId: string): void {
  void runMapJob(mapId).catch((err) => {
    console.error(`[map ${mapId}] unhandled:`, err)
  })
}
