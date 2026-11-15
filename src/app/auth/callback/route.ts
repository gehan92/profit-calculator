import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { dashboardPath, safeNextPath, splitLocale } from "@/lib/auth/routes";
import { BusinessRepository } from "@/lib/business/business-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback — Supabase sends people here after "Continue with Google"
 * or after they open the email login link (Part F2).
 *
 * 1. Swap the one-time `code` for a login session (sets the cookies).
 * 2. First login: create "My Shop" in the person's language (Part D2).
 * 3. Go to `next` (only paths on this site), adding `?welcome=` the first time.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), dashboardPath());
  const locale = splitLocale(next).locale ?? DEFAULT_LOCALE;
  const code = searchParams.get("code");

  if (!code) return failed(origin, locale);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failed(origin, locale);

  const target = new URL(next, origin);
  try {
    const t = await getTranslations({ locale, namespace: "dashboard" });
    const { created } = await new BusinessRepository(supabase).ensureFirstBusiness(
      data.user.id,
      locale,
      t("defaultShopName"),
    );
    if (created) target.searchParams.set("welcome", signupMethod(data.user.app_metadata));
  } catch (cause) {
    // The person is logged in; the dashboard tries to create the shop again.
    console.error("First-login shop creation failed", cause);
  }

  return noStore(NextResponse.redirect(target));
}

/** Back to the login page with a friendly "couldn't log you in" message. */
function failed(origin: string, locale: string) {
  return noStore(NextResponse.redirect(new URL(`/${locale}/login?error=callback`, origin)));
}

/** Login responses carry session cookies, so no cache may keep them. */
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** "google" or "email", for the `signup` analytics event (Part F4.6). */
function signupMethod(appMetadata: { provider?: string }): "google" | "email" {
  return appMetadata.provider === "google" ? "google" : "email";
}
