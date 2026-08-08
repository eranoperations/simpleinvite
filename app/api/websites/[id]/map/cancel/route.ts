import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notFound, requireUser } from '@/lib/auth/require'
import { cancel } from '@/lib/jobs/registry'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const owned = db.prepare('SELECT 1 FROM websites WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!owned) return notFound('Website not found.')

  const map = db.prepare('SELECT id FROM maps WHERE website_id = ?').get(id) as
    | { id: string }
    | undefined
  if (!map) return notFound('This website has no map.')

  return NextResponse.json({ cancelled: cancel(map.id) })
}
