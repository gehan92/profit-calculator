import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountTabs } from "@/components/account/account-tabs";
import {
  LanguagePanel,
  NotificationsPanel,
  PlanPanel,
  PrivacyPanel,
  ProfilePanel,
  SecurityPanel,
} from "@/components/account/account-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { accountTabFrom, type AccountTab } from "@/lib/account/tabs";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { landing } from "@/lib/roles";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "accountPage" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/account — the Account page (spec D6): every logged-in person,
 * whatever their role, keeps their own details here, in six sections
 * (Profile, Login & security, Language & region, Plan & billing, Privacy &
 * data, Notifications). Shop settings stay in Settings (Owner only).
 */
export default function AccountPage({ params, searchParams }: PageProps<"/[locale]/account">) {
  return (
    <div className="space-y-5 py-6 sm:py-8">
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AccountContent({
  params,
  searchParams,
}: Pick<PageProps<"/[locale]/account">, "params" | "searchParams">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const tab = accountTabFrom((await searchParams).tab);
  // Sends a guest to the login page, a paused account to its own screen.
  const { membership } = await getDashboardContext(locale);
  const t = await getTranslations({ locale, namespace: "accountPage" });

  return (
    <>
      <Link
        href={landing(membership.role)}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AccountTabs active={tab} />

      {/* A key per section, so moving between sections never reuses another section's form state. */}
      <Panel key={tab} tab={tab} locale={locale} />
    </>
  );
}

function Panel({ tab, locale }: { tab: AccountTab; locale: AppLocale }) {
  switch (tab) {
    case "profile":
      return <ProfilePanel locale={locale} />;
    case "security":
      return <SecurityPanel locale={locale} />;
    case "language":
      return <LanguagePanel locale={locale} />;
    case "plan":
      return <PlanPanel locale={locale} />;
    case "privacy":
      return <PrivacyPanel locale={locale} />;
    case "notifications":
      return <NotificationsPanel locale={locale} />;
  }
}

function AccountSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
