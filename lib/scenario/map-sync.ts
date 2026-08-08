import fs from 'node:fs'
import path from 'node:path'
import { getDb, newId, now, SCREENSHOT_DIR } from '@/lib/db'
import type { MapRow } from '@/lib/db/types'
import { canonicalize, isSameSite } from '@/lib/crawl/url-guard'
import type { StepOutcome } from './executor'

/**
 * A scenario tied to a map can wander onto pages the crawl never found —
 * behind a click a crawler wouldn't try on its own, or gated by the very
 * login the scenario just performed. Folding each run's visited pages into
 * the map keeps the graph current between full recrawls, instead of it only
 * ever reflecting the last time someone re-ran the crawl.
 *
 * Existing nodes and edges are left untouched — this only ever adds.
 */
export function syncMapFromRun(mapId: string, outcomes: StepOutcome[], runScreenshotDir: string): void {
  const db = getDb()
  const map = db.prepare('SELECT * FROM maps WHERE id = ?').get(mapId) as MapRow | undefined
  if (!map) return

  const existing = db
    .prepare('SELECT id, canonical_url FROM map_nodes WHERE map_id = ?')
    .all(mapId) as { id: string; canonical_url: string }[]
  const nodeIds = new Map(existing.map((n) => [n.canonical_url, n.id]))

  const insertNode = db.prepare(
    `INSERT INTO map_nodes
       (id, map_id, url, canonical_url, title, status_code, load_time_ms, depth, kind,
        screenshot_path, console_errors_json, forms_json, interactive_json, error)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?, NULL, NULL, NULL, NULL)`,
  )
  const insertEdge = db.prepare(
    `INSERT OR IGNORE INTO map_edges (id, map_id, from_node_id, to_node_id, kind, label, selector)
     VALUES (?, ?, ?, ?, 'scenario', ?, NULL)`,
  )

  function ensureNode(outcome: StepOutcome, canonical: string): string {
    const existingId = nodeIds.get(canonical)
    if (existingId) return existingId

    const id = newId()
    const kind = isSameSite(canonical, map!.target_url) ? 'page' : 'external'
    insertNode.run(id, mapId, outcome.url, canonical, titleFromUrl(canonical), kind, copyScreenshot(outcome))
    nodeIds.set(canonical, id)
    return id
  }

  function copyScreenshot(outcome: StepOutcome): string | null {
    if (!outcome.screenshotFile) return null
    const source = path.join(runScreenshotDir, outcome.screenshotFile)
    if (!fs.existsSync(source)) return null

    const destDir = path.join(SCREENSHOT_DIR, 'maps', mapId)
    const destFile = `scenario-${now()}-${newId()}.jpg`
    try {
      fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(source, path.join(destDir, destFile))
      return destFile
    } catch {
      return null
    }
  }

  let previousId: string | null = null
  let previousCanonical: string | null = null

  db.transaction(() => {
    for (const outcome of outcomes) {
      if (!outcome.url) continue
      const canonical = canonicalize(outcome.url)
      if (canonical === previousCanonical) continue

      const id = ensureNode(outcome, canonical)
      if (previousId && previousId !== id) {
        insertEdge.run(newId(), mapId, previousId, id, outcome.description.slice(0, 120))
      }
      previousId = id
      previousCanonical = canonical
    }
  })()
}

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname === '/' ? u.hostname : u.pathname
  } catch {
    return url
  }
}
