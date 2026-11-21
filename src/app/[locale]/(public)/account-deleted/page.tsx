import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account-deleted">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "accountDeleted" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/account-deleted — where a person lands after "Delete my account"
 * (Part D2 Settings): a short confirmation that everything is gone. Not
 * listed in search engines or the sitemap.
 */
export default async function AccountDeletedPage() {
  const t = await getTranslations("accountDeleted");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center sm:py-24">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <CircleCheckIcon aria-hidden="true" className="size-7" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">{t("title")}</h1>
      <p className="mt-3 text-pretty text-muted-foreground">{t("body")}</p>
      <Button asChild className="mt-8 h-12 px-8 text-base">
        <Link href="/">{t("home")}</Link>
      </Button>
    </div>
  );
}
