import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { MapRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { clearMap } from '@/lib/jobs/map-job'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const owned = db.prepare('SELECT 1 FROM websites WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!owned) return notFound('Website not found.')

  const map = db.prepare('SELECT * FROM maps WHERE website_id = ?').get(id) as MapRow | undefined
  if (!map) return notFound('This website has no map.')

  if (map.status === 'queued' || map.status === 'running') {
    return NextResponse.json(
      { error: 'Cancel the running crawl before clearing the map.' },
      { status: 409 },
    )
  }

  clearMap(map.id)

  return NextResponse.json({ ok: true })
}
