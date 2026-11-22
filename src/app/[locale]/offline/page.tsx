import { WifiOffIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { MessageScreen } from "@/components/layout/message-screen";
import { ReloadButton } from "@/components/layout/reload-button";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/offline">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "offlinePage" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * /[locale]/offline — shown by the service worker when a page cannot be loaded
 * and no saved copy exists (Part E4: friendly message + one action). It is
 * saved on the phone when the worker installs, so it needs no network.
 */
export default async function OfflinePage({ params }: PageProps<"/[locale]/offline">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations("offlinePage");
  return (
    <MessageScreen icon={WifiOffIcon} tone="warning" title={t("title")} actions={<ReloadButton>{t("retry")}</ReloadButton>}>
      <p>{t("body")}</p>
    </MessageScreen>
  );
}
