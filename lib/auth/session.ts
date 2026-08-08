import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { getDb, now } from '@/lib/db'
import type { SessionRow, UserRow } from '@/lib/db/types'

export const SESSION_COOKIE = 'aisc_session'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface SessionUser {
  id: string
  email: string
  name: string | null
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const db = getDb()
  // Opaque, high-entropy, and stored as-is: nothing about the user is derivable
  // from the token, so there is no payload to forge.
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = now() + MAX_AGE_MS

  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(token, userId, expiresAt, now())

  return { token, expiresAt }
}

export async function setSessionCookie(token: string, expiresAt: number): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  })
}

/** Resolves the caller's account, or null. Also sweeps expired rows opportunistically. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const db = getDb()
  const session = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(token) as SessionRow | undefined

  if (!session) return null

  if (session.expires_at < now()) {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now())
    return null
  }

  const user = db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .get(session.user_id) as Pick<UserRow, 'id' | 'email' | 'name'> | undefined

  return user ?? null
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) getDb().prepare('DELETE FROM sessions WHERE id = ?').run(token)
  store.delete(SESSION_COOKIE)
}
