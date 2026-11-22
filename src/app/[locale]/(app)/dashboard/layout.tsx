import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityPing } from "@/components/dashboard/activity-ping";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { EntryDeleteProvider } from "@/components/dashboard/entry-delete-provider";
import { OfflineStatus } from "@/components/offline/offline-status";
import { MaintenanceBanner } from "@/components/platform/maintenance-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflinePages } from "@/components/pwa/offline-pages";
import type { AppLocale } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

/**
 * Shell for every dashboard screen (Part F2 folder structure): loads the
 * membership + role and builds the menu for that role — bottom tabs on
 * phones, a sidebar on laptops (Part C1).
 *
 * Access to each screen is checked by the page itself
 * (`requireDashboardPage`), because a layout does not run again when moving
 * between the pages inside it.
 */
export default async function DashboardLayout({ children, params }: LayoutProps<"/[locale]/dashboard">) {
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
      {/* "Back soon" strip while the Admin has maintenance mode ON (Part C2). */}
      <Suspense fallback={null}>
        <MaintenanceBanner />
      </Suspense>
      {/* Offer to add the app to the home screen (second visit onwards, Part F4.4). */}
      <InstallPrompt />
      {/* Amber banner while offline, and the sender for records added offline. */}
      <OfflineStatus />
      {/* Marks the person as active, for the admin's "last active" column. */}
      <ActivityPing />

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 lg:px-6">
        <Suspense fallback={<div className="hidden w-56 shrink-0 lg:block" />}>
          <RoleNav locale={locale} variant="sidebar" />
        </Suspense>
        {/* Room at the bottom on phones so the tab bar never covers content. */}
        {/* The provider keeps "delete with Undo" running while people move between screens. */}
        <main id="main-content" className="min-w-0 flex-1 pb-24 lg:pb-12">
          <EntryDeleteProvider>{children}</EntryDeleteProvider>
        </main>
      </div>

      <Suspense fallback={null}>
        <RoleNav locale={locale} variant="tabs" />
      </Suspense>

      {/* Saved for offline use soon after the page loads, so the app can be opened and used without internet. */}
      <OfflinePages group="dashboard" urls={[`/${locale}/dashboard`, `/${locale}/dashboard/add`]} />
    </>
  );
}

async function RoleNav({ locale, variant }: { locale: AppLocale; variant: "tabs" | "sidebar" }) {
  const { membership } = await getDashboardContext(locale);
  return <DashboardNav role={membership.role} variant={variant} />;
}
