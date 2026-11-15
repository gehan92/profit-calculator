import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Shell for logged-in pages (/dashboard...).
 * Day 8 replaces the header with role-based navigation (bottom tabs on
 * phones, sidebar on laptops, Part C1).
 */
export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("common");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="main-content" className="flex-1 bg-card">
        {children}
      </main>
    </>
  );
}
