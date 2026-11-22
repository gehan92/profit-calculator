import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "login" });
  // A login page has nothing for search engines.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

/**
 * /[locale]/login (Part C1.7): "Welcome back", with Google or an email link,
 * and a link to Create free account. Logged-in people never see it: the proxy
 * sends them on to `next`.
 */
export default function LoginPage() {
  return <AuthPage mode="login" />;
}
