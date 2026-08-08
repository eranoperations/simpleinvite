import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, newId, now } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { createSession, setSessionCookie } from '@/lib/auth/session'

export const runtime = 'nodejs'

const Body = z.object({
  email: z.string().email('Enter a valid email address.').max(200),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  name: z.string().max(100).optional(),
})

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid details.' },
      { status: 400 },
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const db = getDb()

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return NextResponse.json({ error: 'That email is already registered.' }, { status: 409 })
  }

  const id = newId()
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email, await hashPassword(parsed.data.password), parsed.data.name?.trim() || null, now())

  const { token, expiresAt } = createSession(id)
  await setSessionCookie(token, expiresAt)

  return NextResponse.json({ ok: true })
}
