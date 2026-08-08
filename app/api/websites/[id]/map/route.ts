import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { MapRow, WebsiteRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { mapGraph, mapSummary } from '@/lib/api/serialize'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const website = db.prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?').get(id, user.id) as
    | WebsiteRow
    | undefined
  if (!website) return notFound('Website not found.')

  const map = db.prepare('SELECT * FROM maps WHERE website_id = ?').get(id) as MapRow | undefined
  if (!map) return notFound('This website has no map.')

  return NextResponse.json({
    map: mapSummary(map),
    graph: mapGraph(map.id, map.target_url),
  })
}
