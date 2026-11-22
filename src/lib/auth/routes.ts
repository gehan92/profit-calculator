import { publicRoutes } from "@/config/site";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "@/i18n/config";

/**
 * Login-related paths and rules, defined once (Part C1 "Access rules", Part F2).
 * Paths here are without the language prefix unless the name says otherwise.
 */
export const authRoutes = {
  login: "/login",
  dashboard: "/dashboard",
  /** Guest "My Business (try)"; logged-in people use the dashboard instead. */
  tryMyBusiness: publicRoutes.tryMyBusiness,
  /** Outside `[locale]`: Supabase sends people back here after Google or the email link. */
  callback: "/auth/callback",
} as const;

/** Pages that need a logged-in user. Everyone else sees them only after logging in. */
const PROTECTED_PREFIXES = [authRoutes.dashboard] as const;

/** "/si/dashboard/add" → { locale: "si", path: "/dashboard/add" }; "/about" → { locale: null, path: "/about" }. */
export function splitLocale(pathname: string): { locale: AppLocale | null; path: string } {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isAppLocale(first)) return { locale: null, path: pathname };
  return { locale: first, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
}

/** True for /dashboard and everything under it. */
export function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** True for /admin and everything under it (the English-only admin panel, outside `[locale]`). */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Where the proxy sends everyone who may not open /admin: an address that
 * does not exist, so they get the same 404 page as for any wrong address and
 * cannot tell that an admin panel exists (Part C2 "Access rules").
 */
export const ADMIN_HIDDEN_PATH = `/${DEFAULT_LOCALE}/page-not-found`;

/** True for the login page itself. */
export function isLoginPath(path: string): boolean {
  return path === authRoutes.login;
}

/** True for guest My Business, which sends logged-in people to their dashboard (Part F2 routes). */
export function isTryPath(path: string): boolean {
  return path === authRoutes.tryMyBusiness;
}

/**
 * Where to go after logging in. Accepts only paths on this website, so a
 * crafted link like `?next=https://evil.example` or `?next=//evil.example`
 * can never send someone to another site (open redirect).
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  // Anything with a scheme or host after decoding is refused as well.
  try {
    const parsed = new URL(value, "https://placeholder.invalid");
    if (parsed.origin !== "https://placeholder.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

/** The dashboard in one language, e.g. "/si/dashboard". The default landing page after login. */
export function dashboardPath(locale: AppLocale = DEFAULT_LOCALE): string {
  return `/${locale}${authRoutes.dashboard}`;
}

/** The "Your account is paused" screen in one language (Part C2, Part F2 `paused/page.tsx`). */
export function pausedPath(locale: AppLocale = DEFAULT_LOCALE): string {
  return `/${locale}/paused`;
}

/** The login page in one language, keeping where the person wanted to go. */
export function loginPath(locale: AppLocale, next?: string): string {
  const base = `/${locale}${authRoutes.login}`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
