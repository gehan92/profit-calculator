import "server-only";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AppLocale } from "@/i18n/config";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { dashboardPath, loginPath } from "@/lib/auth/routes";
import { BusinessRepository, type Membership } from "@/lib/business/business-repository";
import { canOpen, landing, type DashboardRoute } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Query flag that makes the landing page say "You don't have access" (Part E4). */
export const NO_ACCESS_PARAM = "noAccess";

export interface DashboardContext {
  user: CurrentUser;
  membership: Membership;
}

/**
 * The logged-in user and their shop + role, for every dashboard screen.
 * Sends guests to the login page. `cache()` makes the layout and the page
 * share one database call per request.
 *
 * Reads the login cookie: call it inside a <Suspense> boundary.
 */
export const getDashboardContext = cache(async (locale: AppLocale): Promise<DashboardContext> => {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(locale, dashboardPath(locale)));

  const [supabase, t] = await Promise.all([
    createSupabaseServerClient(),
    getTranslations({ locale, namespace: "dashboard" }),
  ]);
  // Normally created in /auth/callback; this repairs it if that step failed.
  const { membership } = await new BusinessRepository(supabase).ensureFirstBusiness(
    user.id,
    locale,
    t("defaultShopName"),
  );
  return { user, membership };
});

/**
 * Opens one dashboard screen (Part F2 "Routes and access"): guests go to
 * login, roles that may not open `route` go to their own landing page with
 * a "You don't have access" message.
 *
 * Every page calls this itself, because a layout does not run again when
 * moving between pages inside it.
 */
export async function requireDashboardPage(
  locale: AppLocale,
  route: DashboardRoute,
): Promise<DashboardContext> {
  const context = await getDashboardContext(locale);
  const { role } = context.membership;
  if (!canOpen(role, route)) {
    redirect(`/${locale}${landing(role)}?${NO_ACCESS_PARAM}=1`);
  }
  return context;
}
