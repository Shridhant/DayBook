import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect only (AGENTS.md §8): no session cookie → login page. This is NOT the
 * security check; every admin/staff page and API route verifies the session and role on the server.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // All /admin pages except the login page itself, and the staff portal.
  matcher: ["/admin", "/admin/((?!login).*)", "/staff", "/staff/:path*"],
};
