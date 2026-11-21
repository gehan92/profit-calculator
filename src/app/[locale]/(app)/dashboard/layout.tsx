import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
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

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 lg:px-6">
        <Suspense fallback={<div className="hidden w-56 shrink-0 lg:block" />}>
          <RoleNav locale={locale} variant="sidebar" />
        </Suspense>
        {/* Room at the bottom on phones so the tab bar never covers content. */}
        <main id="main-content" className="min-w-0 flex-1 pb-24 lg:pb-12">
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <RoleNav locale={locale} variant="tabs" />
      </Suspense>
    </>
  );
}

async function RoleNav({ locale, variant }: { locale: AppLocale; variant: "tabs" | "sidebar" }) {
  const { membership } = await getDashboardContext(locale);
  return <DashboardNav role={membership.role} variant={variant} />;
}
