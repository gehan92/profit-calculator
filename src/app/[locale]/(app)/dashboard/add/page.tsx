import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddEntryPanel } from "@/components/dashboard/add-entry-panel";
import { CurrencyProvider } from "@/components/currency-context";
import { ShopCatalogProvider } from "@/components/shop-catalog-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireDashboardPage } from "@/lib/auth/dashboard-access";
import type { EntryType } from "@/lib/entries/entry";
import { dashboardRoutes } from "@/lib/roles";
import { loadShopCatalogOnce } from "@/lib/shop-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/add">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "myBusiness" });
  return { title: t("addTitle"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard/add — Add entry (Part C2 wireframe, Part D2): Owner
 * and Staff. `?type=expense` opens with Expense chosen (from the home buttons).
 */
export default async function AddEntryPage({ params, searchParams }: PageProps<"/[locale]/dashboard/add">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, tBusiness] = await Promise.all([
    getTranslations({ locale, namespace: "addEntry" }),
    getTranslations({ locale, namespace: "myBusiness" }),
  ]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={dashboardRoutes.home}
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t("backHome")}
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold tracking-tight text-balance">
        {tBusiness("addTitle")}
      </h1>

      <div className="rounded-2xl border bg-background p-5 shadow-lg shadow-primary/5 sm:p-6">
        <Suspense fallback={<Skeleton aria-hidden="true" className="h-[34rem] w-full rounded-xl" />}>
          <AddEntryContent locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function AddEntryContent({
  locale,
  searchParams,
}: {
  locale: (typeof routing.locales)[number];
  searchParams: PageProps<"/[locale]/dashboard/add">["searchParams"];
}) {
  const { membership } = await requireDashboardPage(locale, dashboardRoutes.add);
  const { type } = await searchParams;
  const initialType: EntryType = type === "expense" ? "expense" : "income";

  const catalog = await loadShopCatalogOnce(await createSupabaseServerClient(), membership.business.id);

  // `key`: the two home buttons open the same page; start fresh for each type.
  return (
    <CurrencyProvider currency={membership.business.currency}>
      <ShopCatalogProvider categories={catalog.categories} products={catalog.products}>
        <AddEntryPanel key={initialType} role={membership.role} initialType={initialType} />
      </ShopCatalogProvider>
    </CurrencyProvider>
  );
}
