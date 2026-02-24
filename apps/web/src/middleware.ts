import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/onboarding"];
const AUTH_ROUTES = ["/sign-in", "/sign-up"];
const ALWAYS_ALLOWED = ["/sign-out"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Manual fallback to forcefully clear cookies if parameter is present
  if (request.nextUrl.searchParams.get("clear_auth") === "1") {
    const url = new URL(request.url);
    url.searchParams.delete("clear_auth");
    const response = NextResponse.redirect(url);
    const domain = request.nextUrl.hostname.includes("localhost")
      ? undefined
      : "llmrank.app";

    response.cookies.set("better-auth.session_token", "", {
      maxAge: 0,
      domain,
    });
    response.cookies.set("__Secure-better-auth.session_token", "", {
      maxAge: 0,
      domain,
    });
    return response;
  }

  // Check for Better Auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");
  const hasSession = !!sessionCookie?.value;

  // Always allow sign-out
  if (ALWAYS_ALLOWED.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  if (isProtected && !hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/sign-out",
  ],
};
