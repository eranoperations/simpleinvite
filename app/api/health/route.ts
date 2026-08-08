import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { reapStale } from '@/lib/jobs/registry'
import { isAiConfigured } from '@/lib/ai/config'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const db = getDb()
    db.prepare('SELECT 1').get()
    // Piggy-backs on the health check so a restart's orphaned jobs get cleaned
    // up without a scheduler.
    const reaped = reapStale()

    return NextResponse.json({
      ok: true,
      database: 'connected',
      ai: isAiConfigured() ? 'configured' : 'not configured',
      reapedStaleJobs: reaped,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 })
  }
}
