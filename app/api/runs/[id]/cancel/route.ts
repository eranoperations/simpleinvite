import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notFound, requireUser } from '@/lib/auth/require'
import { cancel } from '@/lib/jobs/registry'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  if (!getDb().prepare('SELECT 1 FROM runs WHERE id = ? AND user_id = ?').get(id, user.id)) {
    return notFound('Run not found.')
  }

  return NextResponse.json({ cancelled: cancel(id) })
}
