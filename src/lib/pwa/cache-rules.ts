import { LOCALES, type AppLocale } from "@/i18n/config";

/**
 * Which pages the service worker may keep for offline use (Part F4.4: "cache
 * calculator pages and static files; network-first for dashboard data"). Pure
 * functions, so the rules are tested here and the worker only applies them.
 *
 * Do not import anything with side effects or environment variables here: this
 * file is bundled into the service worker, which has no `process.env`.
 */

/**
 * - `private`: one person's shop (dashboard, paused screen). Kept for offline
 *   use but cleared at log out (see `clearPrivateCaches`).
 * - `public`: looks the same for everyone (home, calculators, guest My Business).
 * - `never`: must always come from the network, or is not a page at all.
 */
export type PageKind = "private" | "public" | "never";

/** First path parts that are never kept: the admin panel, login, the callback, APIs, the worker itself. */
const NEVER_PREFIXES = ["/admin", "/auth", "/api", "/serwist", "/_next", "/_vercel"] as const;

/** Pages (after the language) that are never kept: login has no use offline and redirects when logged in. */
const NEVER_PAGES = ["/login", "/offline"] as const;

/** Pages (after the language) that show one person's data. */
const PRIVATE_PREFIXES = ["/dashboard", "/paused"] as const;

/** "/si/dashboard/add" → { locale: "si", path: "/dashboard/add" }; "/about" → { locale: null, path: "/about" }. */
export function splitLocalePath(pathname: string): { locale: AppLocale | null; path: string } {
  const [, first = "", ...rest] = pathname.split("/");
  const locale = (LOCALES as readonly string[]).includes(first) ? (first as AppLocale) : null;
  if (!locale) return { locale: null, path: pathname };
  return { locale, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
}

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function classifyPath(pathname: string): PageKind {
  if (NEVER_PREFIXES.some((prefix) => isUnder(pathname, prefix))) return "never";

  const { path } = splitLocalePath(pathname);
  if (NEVER_PAGES.some((page) => path === page)) return "never";
  if (PRIVATE_PREFIXES.some((prefix) => isUnder(path, prefix))) return "private";
  return "public";
}

/** The language of a page address, for choosing the offline page in the right language. */
export function localeOfPath(pathname: string): AppLocale | null {
  return splitLocalePath(pathname).locale;
}

/** The offline page of one language (precached, so it can be shown without a network). */
export function offlinePagePath(locale: AppLocale): string {
  return `/${locale}/offline`;
}
