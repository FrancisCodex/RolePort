import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

/**
 * Optimistic redirects only, based on whether a session cookie exists.
 * Real authorization happens in lib/session.ts close to the data.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (AUTH_PAGES.includes(pathname)) {
    return hasSession ? NextResponse.redirect(new URL("/home", request.url)) : NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/jobs/:path*", "/pipeline/:path*", "/coach/:path*", "/profile/:path*", "/sign-in", "/sign-up"],
};
