import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "signup" });
  // Nothing on this page is for search engines; the home page is the doorway.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

/**
 * /[locale]/signup (Part C1.7): "Create your free account", with Google or an
 * email link, and a link to Log in. Someone who already has an account is
 * simply logged in ("Welcome back"). There is no role picker here: everyone
 * who creates an account is an Owner of their own shop.
 */
export default function SignupPage() {
  return <AuthPage mode="signup" />;
}
