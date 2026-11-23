import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityPing } from "@/components/dashboard/activity-ping";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MaintenanceBanner } from "@/components/platform/maintenance-banner";
import { routing } from "@/i18n/routing";

/**
 * Shell of the Account page (spec D6): the same top bar as the dashboard, then
 * one centred column. There is no role menu here, because every logged-in
 * person has an Account page whatever their role; the page itself has a link
 * back to their own start screen.
 */
export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skipToContent")}
      </a>
      <DashboardHeader locale={locale} />
      <Suspense fallback={null}>
        <MaintenanceBanner />
      </Suspense>
      {/* Marks the person as active, for the admin's "last active" column. */}
      <ActivityPing />

      <main id="main-content" className="mx-auto w-full max-w-3xl min-w-0 flex-1 px-4 pb-16 sm:px-6">
        {children}
      </main>
    </>
  );
}
