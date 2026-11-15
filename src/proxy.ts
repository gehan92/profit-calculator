import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Runs before every page request (Part F2, "How a request flows").
 *
 * Day 1: picks the language (next-intl).
 * Day 6: will also refresh the Supabase session cookie and send logged-out
 *        users away from /dashboard and /admin.
 *
 * Proxy is only the first guard. Pages, Server Actions and database RLS
 * always check access again.
 */
const handleI18nRouting = createIntlMiddleware(routing);

/** Routes that live outside `[locale]`: the English-only admin panel and the auth callback. */
const NON_LOCALIZED_PREFIXES = ["/admin", "/auth"] as const;

export default function proxy(request: NextRequest) {
  if (isNonLocalizedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return handleI18nRouting(request);
}

function isNonLocalizedPath(pathname: string): boolean {
  return NON_LOCALIZED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const config = {
  // Skip Next.js internals and any file with an extension (icons, robots.txt, sitemap.xml...).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
