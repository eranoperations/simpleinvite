import { NextResponse } from 'next/server'
import { getSessionUser, type SessionUser } from './session'

/**
 * Every API route calls this. Middleware only checks that a cookie is present —
 * it cannot verify the session or scope a query, so authorization lives here.
 */
export async function requireUser(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getSessionUser()
  if (!user) {
    return {
      response: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }),
    }
  }
  return { user }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = 'Not found.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}
