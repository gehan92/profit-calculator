import { LogOutIcon, PackageIcon, TagsIcon, UserCogIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LogoutForm } from "@/components/auth/logout-form";
import { ExportCard } from "@/components/settings/export-card";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsLink } from "@/components/settings/settings-link";
import { ShopSettingsForm } from "@/components/settings/shop-settings-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { ACCOUNT_PATH } from "@/lib/account/tabs";
import { requireDashboardPage } from "@/lib/auth/dashboard-access";
import { dashboardRoutes } from "@/lib/roles";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/settings">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard/settings — Settings (Part D2): the shop's name, language
 * and currency, its categories and products, the CSV download, and log out.
 * Owner only. The person's own details (support access, their data, deleting
 * the account, plan, login) are on the Account page (spec D6), open to every role.
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

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <SettingsCard id="shop" title={t("shopTitle")}>
        <ShopSettingsForm
          initial={{ name: membership.business.name, currency: membership.business.currency }}
        />
      </SettingsCard>

      {/* The shop's own lists (Part D8, D9). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SettingsLink
          href={dashboardRoutes.categories}
          icon={TagsIcon}
          title={t("categoriesTitle")}
          body={t("categoriesBody")}
        />
        <SettingsLink
          href={dashboardRoutes.products}
          icon={PackageIcon}
          title={t("productsTitle")}
          body={t("productsBody")}
        />
      </div>

      <SettingsCard id="export" title={t("exportTitle")} description={t("exportBody")}>
        <ExportCard />
      </SettingsCard>

      <SettingsCard id="account" title={t("accountTitle")}>
        {user.email && (
          <p className="text-sm">
            <span className="block text-muted-foreground">{tAccount("loggedInAs")}</span>
            <span className="block font-medium break-all">{user.email}</span>
          </p>
        )}
        <SettingsLink href={ACCOUNT_PATH} icon={UserCogIcon} title={t("accountPageLink")} body={t("accountPageHint")} />
        {/* A real form: logging out works even before the page's JavaScript has loaded. */}
        <LogoutForm locale={locale}>
          <Button type="submit" variant="outline" className="h-12 w-full bg-background text-base sm:w-auto sm:px-6">
            <LogOutIcon data-icon="inline-start" aria-hidden="true" />
            {tAccount("logout")}
          </Button>
        </LogoutForm>
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
