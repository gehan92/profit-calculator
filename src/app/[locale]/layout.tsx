import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config/site";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

/**
 * Root layout for every translated page: /en, /si, /ta.
 * (The English-only admin panel will get its own root layout on Day 11.)
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "metadata" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    applicationName: t("title"),
    formatDetection: { telephone: false },
    openGraph: { type: "website", siteName: tCommon("appName") },
    // Big preview image when a link is shared (image: app/opengraph-image.tsx).
    twitter: { card: "summary_large_image" },
    // Google Search Console "HTML tag" check (Part F4.5); empty until launch day.
    verification: siteConfig.googleSiteVerification
      ? { google: siteConfig.googleSiteVerification }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster theme="light" position="top-center" richColors />
        {/* Page views (Part F4.6). Sends nothing during local development. */}
        <Analytics />
      </body>
    </html>
  );
}
