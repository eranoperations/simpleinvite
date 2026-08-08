import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, newId, now } from '@/lib/db'
import type { TestUserRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { testUserDto } from '@/lib/api/serialize'

export const runtime = 'nodejs'

const Body = z.object({
  label: z.string().min(1, 'Give this test user a name.').max(120),
  username: z.string().min(1, 'Enter the username or email to sign in with.').max(200),
  password: z.string().min(1, 'Enter the password to sign in with.').max(500),
  loginPath: z.string().max(500).optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const website = db.prepare('SELECT 1 FROM websites WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!website) return notFound('Website not found.')

  const rows = db
    .prepare('SELECT * FROM test_users WHERE website_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(id) as TestUserRow[]

  return NextResponse.json({ testUsers: rows.map(testUserDto) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const db = getDb()
  const website = db.prepare('SELECT 1 FROM websites WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!website) return notFound('Website not found.')

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid test user.' },
      { status: 400 },
    )
  }

  const loginPath = parsed.data.loginPath?.trim() || null
  const testUserId = newId()
  db.prepare(
    `INSERT INTO test_users (id, user_id, website_id, label, username, password, login_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    testUserId,
    user.id,
    id,
    parsed.data.label.trim(),
    parsed.data.username.trim(),
    parsed.data.password,
    loginPath,
    now(),
  )

  return NextResponse.json({ id: testUserId }, { status: 201 })
}
