import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'aisc_session'

/**
 * A cheap gate that keeps signed-out visitors off the app shell. It proves only
 * that a cookie exists — every route handler re-checks the session against the
 * database and scopes its queries by user.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next()

  const login = new URL('/login', request.url)
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/websites/:path*', '/runs/:path*'],
}
