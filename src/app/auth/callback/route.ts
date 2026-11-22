import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/config";
import {
  afterLoginPath,
  dashboardPath,
  FROM_SIGNUP_PARAM,
  FROM_SIGNUP_VALUE,
  loginPath,
  safeNextPath,
  signupPath,
  splitLocale,
  type SignupMethod,
} from "@/lib/auth/routes";
import { BusinessRepository } from "@/lib/business/business-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback — Supabase sends people here after "Continue with Google"
 * or after they open the email login link (Part F2).
 *
 * 1. Swap the one-time `code` for a login session (sets the cookies).
 * 2. First login: create "My Shop" in the person's language (Part D2).
 * 3. Go on: a new account to shop setup (/welcome), an existing one to `next`
 *    (only paths on this site), with "Welcome back" if they used Create free
 *    account by mistake (Part C1.7 "No dead ends").
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), dashboardPath());
  const locale = splitLocale(next).locale ?? DEFAULT_LOCALE;
  const fromSignup = searchParams.get(FROM_SIGNUP_PARAM) === FROM_SIGNUP_VALUE;
  const code = searchParams.get("code");

  if (!code) return failed(origin, locale, fromSignup);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failed(origin, locale, fromSignup);

  let target = next;
  try {
    const t = await getTranslations({ locale, namespace: "dashboard" });
    const { created } = await new BusinessRepository(supabase).ensureFirstBusiness(
      data.user.id,
      locale,
      t("defaultShopName"),
    );
    target = afterLoginPath({ created, fromSignup, locale, method: signupMethod(data.user.app_metadata), next });
  } catch (cause) {
    // The person is logged in; the dashboard tries to create the shop again.
    console.error("First-login shop creation failed", cause);
  }

  return noStore(NextResponse.redirect(new URL(target, origin)));
}

/** Back to the page the person used, with a friendly "couldn't log you in" message. */
function failed(origin: string, locale: AppLocale, fromSignup: boolean) {
  const page = fromSignup ? signupPath(locale) : loginPath(locale);
  return noStore(NextResponse.redirect(new URL(`${page}?error=callback`, origin)));
}

/** Login responses carry session cookies, so no cache may keep them. */
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** "google" or "email", for the `signup` analytics event (Part F4.6). */
function signupMethod(appMetadata: { provider?: string }): SignupMethod {
  return appMetadata.provider === "google" ? "google" : "email";
}
