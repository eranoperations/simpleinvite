import { getDb, now } from '@/lib/db'

/**
 * Jobs run in-process, detached from the request that created them, and report
 * progress by writing to their row. That keeps the deployment to a single
 * service; the cost is that a restart orphans anything in flight, which
 * `reapStale` cleans up.
 */

const running = new Map<string, AbortController>()

/** Chromium is heavy — an unbounded fan-out exhausts memory and takes the app down. */
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_JOBS) || 2
const waiting: (() => void)[] = []
let active = 0

export function register(id: string): AbortController {
  const controller = new AbortController()
  running.set(id, controller)
  return controller
}

export function unregister(id: string): void {
  running.delete(id)
}

export function cancel(id: string): boolean {
  const controller = running.get(id)
  if (!controller) return false
  controller.abort()
  return true
}

export function isRunning(id: string): boolean {
  return running.has(id)
}

/** Resolves when a browser slot is free. Callers must always call `release`. */
export async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return
  }
  await new Promise<void>((resolve) => waiting.push(resolve))
  active++
}

export function releaseSlot(): void {
  active = Math.max(0, active - 1)
  const next = waiting.shift()
  if (next) next()
}

const STALE_AFTER_MS = 60 * 60 * 1000

/**
 * A process restart leaves rows stuck in `running` forever. Anything past the
 * longest plausible job, and not actually running here, is marked failed.
 */
export function reapStale(): number {
  const db = getDb()
  const cutoff = now() - STALE_AFTER_MS
  let reaped = 0

  for (const table of ['maps', 'runs'] as const) {
    const stuck = db
      .prepare(
        `SELECT id FROM ${table}
         WHERE status IN ('queued','running')
           AND COALESCE(started_at, created_at) < ?`,
      )
      .all(cutoff) as { id: string }[]

    for (const row of stuck) {
      if (isRunning(row.id)) continue
      db.prepare(
        `UPDATE ${table}
         SET status = 'failed',
             error = 'Interrupted, most likely by a server restart. Run it again.',
             finished_at = ?
         WHERE id = ?`,
      ).run(now(), row.id)
      reaped++
    }
  }

  return reaped
}
