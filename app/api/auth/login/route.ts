import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import type { UserRow } from '@/lib/db/types'
import { burnTime, verifyPassword } from '@/lib/auth/password'
import { createSession, setSessionCookie } from '@/lib/auth/session'

export const runtime = 'nodejs'

const Body = z.object({
  email: z.string().max(200),
  password: z.string().max(200),
})

// One message for every failure mode — which half was wrong is not the
// caller's business, and telling them enumerates accounts.
const INVALID = 'Invalid email or password.'

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: INVALID }, { status: 401 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const user = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | UserRow
    | undefined

  if (!user) {
    await burnTime(parsed.data.password)
    return NextResponse.json({ error: INVALID }, { status: 401 })
  }

  if (!(await verifyPassword(parsed.data.password, user.password_hash))) {
    return NextResponse.json({ error: INVALID }, { status: 401 })
  }

  const { token, expiresAt } = createSession(user.id)
  await setSessionCookie(token, expiresAt)

  return NextResponse.json({ ok: true })
}
