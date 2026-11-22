import { LogOutIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LogoutForm } from "@/components/auth/logout-form";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ExportCard } from "@/components/settings/export-card";
import { SettingsCard } from "@/components/settings/settings-card";
import { ShopSettingsForm } from "@/components/settings/shop-settings-form";
import { SupportAccessCard } from "@/components/settings/support-access-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { ProfileRepository } from "@/lib/account/profile-repository";
import { isSupportAccessActive } from "@/lib/account/support-access";
import { requireDashboardPage } from "@/lib/auth/dashboard-access";
import { dashboardRoutes } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/settings">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard/settings — Settings (Part D2): shop name, language and
 * currency, download the records as CSV, the support-access switch, log out
 * and delete the account. Owner only.
 */
export default function SettingsPage({ params }: PageProps<"/[locale]/dashboard/settings">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent params={params} />
      </Suspense>
    </div>
  );
}

async function SettingsContent({ params }: Pick<PageProps<"/[locale]/dashboard/settings">, "params">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { user, membership } = await requireDashboardPage(locale, dashboardRoutes.settings);
  const [t, tAccount] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    getTranslations({ locale, namespace: "account" }),
  ]);

  const supportUntil = await new ProfileRepository(await createSupabaseServerClient()).getSupportAccessUntil(
    user.id,
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <SettingsCard id="shop" title={t("shopTitle")}>
        <ShopSettingsForm
          initial={{ name: membership.business.name, currency: membership.business.currency }}
        />
      </SettingsCard>

      <SettingsCard id="export" title={t("exportTitle")} description={t("exportBody")}>
        <ExportCard />
      </SettingsCard>

      <SettingsCard id="support" title={t("supportTitle")} description={t("supportBody")}>
        <SupportAccessCard initialUntil={isSupportAccessActive(supportUntil) ? supportUntil : null} />
      </SettingsCard>

      <SettingsCard id="account" title={t("accountTitle")}>
        {user.email && (
          <p className="text-sm">
            <span className="block text-muted-foreground">{tAccount("loggedInAs")}</span>
            <span className="block font-medium break-all">{user.email}</span>
          </p>
        )}
        {/* A real form: logging out works even before the page's JavaScript has loaded. */}
        <LogoutForm locale={locale}>
          <Button type="submit" variant="outline" className="h-12 w-full bg-background text-base sm:w-auto sm:px-6">
            <LogOutIcon data-icon="inline-start" aria-hidden="true" />
            {tAccount("logout")}
          </Button>
        </LogoutForm>
      </SettingsCard>

      <SettingsCard id="danger" title={t("dangerTitle")} description={t("dangerBody")} danger>
        <DeleteAccountCard />
      </SettingsCard>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-96 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
