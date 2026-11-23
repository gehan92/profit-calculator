import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { WelcomeForm } from "@/components/auth/welcome-form";
import { SignupTracker } from "@/components/dashboard/signup-tracker";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { ProfileRepository } from "@/lib/account/profile-repository";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { dashboardPath } from "@/lib/auth/routes";
import { businessTypeOrDefault } from "@/lib/business/business-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/welcome">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "welcome" });
  // Private: only the person who has just logged in sees it.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/welcome (Part C1.7 "Set up your shop"): shown once after the first
 * login. Shop name, business type, currency and language, then Start; or skip.
 * Only an Owner sets up a shop (Staff and Viewers join one by invite), and
 * guests are sent to log in by the proxy.
 */
export default function WelcomePage({ params, searchParams }: PageProps<"/[locale]/welcome">) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-14">
      <Suspense fallback={<WelcomeSkeleton />}>
        <WelcomeContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WelcomeContent({ params, searchParams }: PageProps<"/[locale]/welcome">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { user, membership } = await getDashboardContext(locale);
  if (membership.role !== "owner") redirect(dashboardPath(locale));
  // The currency the person chose on their Account page (Language & region) comes pre-selected.
  const { defaultCurrency } = await new ProfileRepository(await createSupabaseServerClient()).getAccountProfile(user.id);

  const [t, defaultNames, query] = await Promise.all([
    getTranslations("welcome"),
    Promise.all(
      routing.locales.map(async (code) => (await getTranslations({ locale: code, namespace: "dashboard" }))("defaultShopName")),
    ),
    searchParams,
  ]);
  const { business } = membership;
  const method = query.method === "google" || query.method === "email" ? query.method : null;
  // The name made at first login ("My Shop", in any language) is a placeholder, not an answer.
  const name = defaultNames.includes(business.name) ? "" : business.name;

  return (
    <>
      {method && <SignupTracker method={method} />}
      <div className="rounded-2xl border bg-background p-6 shadow-lg shadow-primary/5 sm:p-8">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t("title")}</h1>
          <p className="text-pretty text-muted-foreground">{t("subtitle")}</p>
        </div>
        <WelcomeForm
          initial={{
            name,
            businessType: businessTypeOrDefault(business.business_type),
            currency: defaultCurrency ?? business.currency,
          }}
        />
      </div>
    </>
  );
}

function WelcomeSkeleton() {
  return (
    <div className="space-y-5 rounded-2xl border bg-background p-6 sm:p-8" aria-hidden="true">
      <Skeleton className="mx-auto h-8 w-48" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
