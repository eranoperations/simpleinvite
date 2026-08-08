import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notFound, requireUser } from '@/lib/auth/require'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const owned = db.prepare('SELECT 1 FROM test_users WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!owned) return notFound('Test user not found.')

  // Maps referencing this test user keep running fine (test_user_id -> NULL);
  // only future maps lose the option to sign in with it.
  db.prepare('DELETE FROM test_users WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
