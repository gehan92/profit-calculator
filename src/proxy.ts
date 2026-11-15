import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import {
  dashboardPath,
  isLoginPath,
  isProtectedPath,
  isTryPath,
  loginPath,
  safeNextPath,
  splitLocale,
} from "@/lib/auth/routes";
import { copySessionTo, refreshSession } from "@/lib/supabase/proxy-session";

/**
 * Runs before every page request (Part F2, "How a request flows"):
 *
 * 1. next-intl picks the language (/en, /si, /ta).
 * 2. Supabase refreshes the login cookie (only when one exists).
 * 3. Guards: logged-out users are sent from /dashboard to /login?next=...,
 *    logged-in users are sent from /login to where they wanted to go and
 *    from /try to their dashboard.
 *
 * Proxy is only the first guard. Pages, Server Actions and database RLS
 * always check access again.
 */
const handleI18nRouting = createIntlMiddleware(routing);

/** Routes that live outside `[locale]`: the English-only admin panel and the auth callback. */
const NON_LOCALIZED_PREFIXES = ["/admin", "/auth"] as const;

export default async function proxy(request: NextRequest) {
  if (isNonLocalizedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = handleI18nRouting(request);
  // next-intl is adding the language to the address (e.g. "/" → "/en"): let that happen first.
  if (isRedirect(response)) return response;

  const { locale, path } = splitLocale(request.nextUrl.pathname);
  const { userId } = await refreshSession(request, response);
  const pageLocale = locale ?? DEFAULT_LOCALE;

  if (!userId && isProtectedPath(path)) {
    const wanted = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return redirectKeepingSession(request, response, loginPath(pageLocale, wanted));
  }

  if (userId && isLoginPath(path)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"), dashboardPath(pageLocale));
    return redirectKeepingSession(request, response, next);
  }

  // Logged-in people keep records in their account, not on the phone (Part F2 routes table).
  // The dashboard offers to move any records left on this phone.
  if (userId && isTryPath(path)) {
    return redirectKeepingSession(request, response, dashboardPath(pageLocale));
  }

  return response;
}

function isNonLocalizedPath(pathname: string): boolean {
  return NON_LOCALIZED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isRedirect(response: NextResponse): boolean {
  return response.status >= 300 && response.status < 400;
}

/** Redirects without losing a session cookie that was just refreshed. */
function redirectKeepingSession(request: NextRequest, from: NextResponse, path: string) {
  return copySessionTo(NextResponse.redirect(new URL(path, request.url)), from);
}

export const config = {
  // Skip Next.js internals and any file with an extension (icons, robots.txt, sitemap.xml...).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
