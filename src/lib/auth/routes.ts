import { publicRoutes } from "@/config/site";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "@/i18n/config";

/**
 * Login-related paths and rules, defined once (Part C1 "Access rules", Part F2).
 * Paths here are without the language prefix unless the name says otherwise.
 */
export const authRoutes = {
  login: "/login",
  /** "Create free account" (Part C1.7): its own page, next to Log in. */
  signup: "/signup",
  /** First-time shop setup, shown once after the first login (Part C1.7). */
  welcome: "/welcome",
  dashboard: "/dashboard",
  /** Guest "My Business (try)"; logged-in people use the dashboard instead. */
  tryMyBusiness: publicRoutes.tryMyBusiness,
  /** Outside `[locale]`: Supabase sends people back here after Google or the email link. */
  callback: "/auth/callback",
} as const;

/** Pages that need a logged-in user. Everyone else sees them only after logging in. */
const PROTECTED_PREFIXES = [authRoutes.dashboard, authRoutes.welcome] as const;

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

/** True for the Create free account page. */
export function isSignupPath(path: string): boolean {
  return path === authRoutes.signup;
}

/** True for Log in and Create free account: logged-in people never see either. */
export function isEntryPath(path: string): boolean {
  return isLoginPath(path) || isSignupPath(path);
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

/** The Create free account page in one language, keeping where the person wanted to go. */
export function signupPath(locale: AppLocale, next?: string): string {
  const base = `/${locale}${authRoutes.signup}`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

/** How the person logged in the first time; used for the `signup` analytics event (Part F4.6). */
export type SignupMethod = "google" | "email";

/** The shop setup page in one language; `method` says how the account was made. */
export function welcomePath(locale: AppLocale, method?: SignupMethod): string {
  const base = `/${locale}${authRoutes.welcome}`;
  return method ? `${base}?method=${method}` : base;
}

/** Query flag that makes the dashboard say "Welcome back" (Create account used by someone who already had one). */
export const WELCOME_BACK_PARAM = "back";

/**
 * Added to the /auth/callback address by the Create free account page, so the
 * callback knows which page the person used (`?from=signup`).
 */
export const FROM_SIGNUP_PARAM = "from";
export const FROM_SIGNUP_VALUE = "signup";

/**
 * Where /auth/callback sends someone who just logged in (Part C1.7, "No dead ends"):
 * - a brand-new account goes to shop setup, whichever page they used;
 * - someone who used Create free account but already had an account is simply
 *   logged in, with a "Welcome back" message;
 * - everyone else goes where they were going.
 */
export function afterLoginPath(options: {
  /** True when this login created the account's first shop. */
  created: boolean;
  /** True when the person came from the Create free account page. */
  fromSignup: boolean;
  locale: AppLocale;
  method: SignupMethod;
  /** Already checked with `safeNextPath`. */
  next: string;
}): string {
  if (options.created) return welcomePath(options.locale, options.method);
  if (!options.fromSignup) return options.next;

  const url = new URL(options.next, "https://placeholder.invalid");
  url.searchParams.set(WELCOME_BACK_PARAM, "1");
  return `${url.pathname}${url.search}`;
}
