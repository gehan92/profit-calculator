import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { GuestBusiness } from "@/components/my-business/guest-business";
import { publicRoutes } from "@/config/site";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/try">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale });
  return pageMetadata({
    locale,
    path: publicRoutes.tryMyBusiness,
    title: t("try.metaTitle"),
    description: t("try.metaDescription"),
    siteName: t("common.appName"),
  });
}

/**
 * /[locale]/try — guest "My Business" (Part C1.1, Part F2 routes table).
 * Records stay in this browser; logged-in people are sent to their
 * dashboard by the proxy. The page itself is static: everything personal
 * is read in the browser.
 */
export default async function TryMyBusinessPage() {
  const t = await getTranslations("try");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">{t("subtitle")}</p>
      </header>

      <GuestBusiness />
    </div>
  );
}
