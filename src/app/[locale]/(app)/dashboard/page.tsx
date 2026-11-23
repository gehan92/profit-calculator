import { ArrowRightIcon, CalculatorIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CurrencyProvider } from "@/components/currency-context";
import { AddButtons } from "@/components/dashboard/add-buttons";
import { GuestImportPrompt } from "@/components/dashboard/guest-import-prompt";
import { NoAccessToast } from "@/components/dashboard/no-access-toast";
import { OwnerHome } from "@/components/dashboard/owner-home";
import { ShopCatalogProvider } from "@/components/shop-catalog-context";
import { WelcomeBackToast } from "@/components/dashboard/welcome-back-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { NO_ACCESS_PARAM, requireDashboardPage } from "@/lib/auth/dashboard-access";
import { WELCOME_BACK_PARAM } from "@/lib/auth/routes";
import { addDays, utcIsoDate } from "@/lib/dates";
import { EntryRepository } from "@/lib/entries/entry-repository";
import { can, dashboardRoutes } from "@/lib/roles";
import { loadShopCatalogOnce } from "@/lib/shop-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * How far back the home screen loads entries: the whole of this month plus
 * yesterday, on any phone calendar (a month is at most 31 days, and the
 * phone may be a day ahead of the server).
 */
const HOME_HISTORY_DAYS = 32;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard — Owner home (Part C2, Part D2 "Home (today)").
 * Staff see only the add buttons here for now: they never see totals, and
 * their full "Today" screen comes with the team features (Phase 4).
 */
export default function DashboardPage({ params, searchParams }: PageProps<"/[locale]/dashboard">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Reads the login cookie, so it streams in behind a boundary (Cache Components). */}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function HomeContent({ params, searchParams }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { membership } = await requireDashboardPage(locale, dashboardRoutes.home);
  const { role, business } = membership;
  const query = await searchParams;

  let ownerHome = null;
  if (can(role, "seeTotals")) {
    const supabase = await createSupabaseServerClient();
    const [entries, catalog] = await Promise.all([
      new EntryRepository(supabase).listSince(business.id, addDays(utcIsoDate(), -HOME_HISTORY_DAYS)),
      loadShopCatalogOnce(supabase, business.id),
    ]);
    ownerHome = (
      <CurrencyProvider currency={business.currency}>
        <ShopCatalogProvider categories={catalog.categories} products={catalog.products}>
          <OwnerHome shopName={business.name} entries={entries} />
        </ShopCatalogProvider>
      </CurrencyProvider>
    );
  }

  return (
    <div className="space-y-6">
      {query[NO_ACCESS_PARAM] && <NoAccessToast />}
      {query[WELCOME_BACK_PARAM] && <WelcomeBackToast />}

      {/* Records made in guest mode on this phone (Part D2 "Move guest data", Owner). */}
      {can(role, "importGuestEntries") && <GuestImportPrompt />}

      {ownerHome ?? <AddButtons />}

      <CalculatorsCard />
    </div>
  );
}

async function CalculatorsCard() {
  const t = await getTranslations("dashboard");

  return (
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
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </div>
  );
}
