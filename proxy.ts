import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_MCC_PATHS = ["/mcc/login", "/mcc/register"];

const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/mcc")) return NextResponse.next();

  if (PUBLIC_MCC_PATHS.some((p) => pathname === p)) {
    if (hasSessionCookie(req)) {
      return NextResponse.redirect(new URL("/mcc", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie(req)) {
    const loginUrl = new URL("/mcc/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/mcc/:path*"],
};
