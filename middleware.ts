import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  
  // Check for any authentication cookie (NextAuth uses various cookie names)
  const cookies = request.cookies.getAll();
  const authCookies = cookies.filter(cookie => 
    cookie.name.includes('session-token') || 
    cookie.name.includes('authjs') ||
    cookie.name.includes('next-auth')
  );
  
  const isLoggedIn = authCookies.length > 0;

  // Only redirect if logged in user tries to access login page
  if (isLoggedIn && nextUrl.pathname === "/login") {
    const dashboardUrl = new URL("/dashboard", nextUrl.origin);
    return NextResponse.redirect(dashboardUrl);
  }

  // Allow access to all other routes without authentication
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};