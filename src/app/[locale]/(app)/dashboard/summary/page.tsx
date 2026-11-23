import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CurrencyProvider } from "@/components/currency-context";
import { ShopCatalogProvider } from "@/components/shop-catalog-context";
import { SummaryView } from "@/components/summary/summary-view";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { requireDashboardPage } from "@/lib/auth/dashboard-access";
import { monthOf, shiftMonth, utcIsoDate } from "@/lib/dates";
import { parseMonthParam } from "@/lib/entries/entry-filters";
import { EntryRepository } from "@/lib/entries/entry-repository";
import { MonthlySummary } from "@/lib/entries/monthly-summary";
import { CategoryCatalog } from "@/lib/categories/category";
import { categoryNameOf } from "@/lib/categories/category-labels";
import { dashboardRoutes } from "@/lib/roles";
import { loadShopCatalogOnce } from "@/lib/shop-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/summary">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "summary" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard/summary — the monthly summary (Part D2): Owner and
 * Viewer. The month comes from the address (`?month=2026-10`), so a month
 * can be reopened or shared. The numbers are added up on the server from
 * every entry of the month through the person's own login, so Row Level
 * Security applies (Staff are never sent here).
 */
export default function SummaryPage({ params, searchParams }: PageProps<"/[locale]/dashboard/summary">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<SummaryPageSkeleton />}>
        <SummaryContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SummaryContent({ params, searchParams }: PageProps<"/[locale]/dashboard/summary">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { membership } = await requireDashboardPage(locale, dashboardRoutes.summary);
  const t = await getTranslations({ locale, namespace: "summary" });

  // The server does not know the phone's calendar: it opens on the current UTC
  // month, and the month arrows reach any other (the same as the Entries list).
  const defaultMonth = monthOf(utcIsoDate());
  const month = parseMonthParam((await searchParams).month, defaultMonth);

  const supabase = await createSupabaseServerClient();
  const entries = new EntryRepository(supabase);
  const businessId = membership.business.id;
  const [current, previous, shop, tCategory] = await Promise.all([
    entries.listMonthForSummary(businessId, month),
    entries.listMonthForSummary(businessId, shiftMonth(month, -1)),
    loadShopCatalogOnce(supabase, businessId),
    getTranslations({ locale, namespace: "categories" }),
  ]);
  // The shop's own categories decide which costs are hidden costs (Settings → Categories).
  const catalog = new CategoryCatalog(shop.categories, (key) => categoryNameOf(tCategory, key));
  const summary = new MonthlySummary(catalog, month, current.entries, previous.entries);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <CurrencyProvider currency={membership.business.currency}>
        <ShopCatalogProvider categories={shop.categories} products={shop.products}>
          <SummaryView
            role={membership.role}
            snapshot={summary.toSnapshot()}
            defaultMonth={defaultMonth}
            truncated={current.truncated}
          />
        </ShopCatalogProvider>
      </CurrencyProvider>
    </div>
  );
}

function SummaryPageSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
