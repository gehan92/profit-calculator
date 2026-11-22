import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflinePages } from "@/components/pwa/offline-pages";
import { CALCULATORS } from "@/config/calculators";
import { routing } from "@/i18n/routing";
import { publicRoutes } from "@/config/site";

/** Shell for all public pages: home, calculators, /try, login, about... */
export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("common");

  // Saved for offline use soon after the first page loads: "works offline after the first visit" (Part D1).
  const offlineUrls = [
    `/${locale}`,
    ...CALCULATORS.map((calculator) => `/${locale}${calculator.href}`),
    `/${locale}${publicRoutes.tryMyBusiness}`,
  ];

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />
      {/* Offer to add the app to the home screen (second visit onwards, Part F4.4). */}
      <InstallPrompt />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <OfflinePages group="public" urls={offlineUrls} />
    </>
  );
}
