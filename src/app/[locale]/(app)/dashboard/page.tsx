import { ArrowRightIcon, CalculatorIcon, LogOutIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/actions/auth";
import { ShopNameForm } from "@/components/dashboard/shop-name-form";
import { SignupTracker } from "@/components/dashboard/signup-tracker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dashboardPath, loginPath } from "@/lib/auth/routes";
import { BusinessRepository } from "@/lib/business/business-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard — Day 6 version: proves login works and the first shop
 * exists ("Done when: Can log in; profile + shop created", Part G1).
 * Day 8 turns this into the Owner home with today's profit.
 */
export default function DashboardPage({ params, searchParams }: PageProps<"/[locale]/dashboard">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Reads the login cookie, so it streams in behind a boundary (Cache Components). */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ params, searchParams }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Second guard after the proxy (Part F5: "never trust the UI alone").
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(locale, dashboardPath(locale)));

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const supabase = await createSupabaseServerClient();
  // Normally created in /auth/callback; this repairs it if that step failed.
  const { membership } = await new BusinessRepository(supabase).ensureFirstBusiness(
    user.id,
    locale,
    t("defaultShopName"),
  );

  const { welcome } = await searchParams;
  const signupMethod = welcome === "google" || welcome === "email" ? welcome : null;
  const askShopName = signupMethod !== null && membership.role === "owner";

  return (
    <div className="space-y-6">
      {signupMethod && <SignupTracker method={signupMethod} />}

      <section className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-primary-foreground/80 uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {t("welcomeTitle", { shop: membership.business.name })}
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-primary-foreground/85">{t("welcomeBody")}</p>
      </section>

      {askShopName && <ShopNameForm businessId={membership.business.id} />}

      <section className="flex flex-col gap-4 rounded-2xl border bg-background p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CalculatorIcon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t("calculatorsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("calculatorsBody")}</p>
          </div>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/#calculators">
            {t("openCalculators")}
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <footer className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm break-all text-muted-foreground">
          {user.email && t("loggedInAs", { email: user.email })}
        </p>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost" className="w-full text-muted-foreground sm:w-auto">
            <LogOutIcon data-icon="inline-start" aria-hidden="true" />
            {t("logout")}
          </Button>
        </form>
      </footer>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}
