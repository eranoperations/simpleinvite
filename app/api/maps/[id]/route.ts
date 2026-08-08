import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { MapRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { mapGraph, mapSummary } from '@/lib/api/serialize'
import { cancel } from '@/lib/jobs/registry'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** Ownership is enforced in the query itself, not checked afterwards. */
function ownedMap(id: string, userId: string): MapRow | undefined {
  return getDb().prepare('SELECT * FROM maps WHERE id = ? AND user_id = ?').get(id, userId) as
    | MapRow
    | undefined
}

export async function GET(_request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const map = ownedMap(id, user.id)
  if (!map) return notFound('Map not found.')

  return NextResponse.json({
    map: mapSummary(map),
    graph: mapGraph(map.id, map.target_url),
  })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  if (!ownedMap(id, user.id)) return notFound('Map not found.')

  cancel(id)
  // Nodes and edges go with it via ON DELETE CASCADE.
  getDb().prepare('DELETE FROM maps WHERE id = ?').run(id)

  return NextResponse.json({ ok: true })
}
