import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CurrencyProvider } from "@/components/currency-context";
import { ProductsView } from "@/components/products/products-view";
import { ShopCatalogProvider } from "@/components/shop-catalog-context";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { requireDashboardPage } from "@/lib/auth/dashboard-access";
import { ProductRepository } from "@/lib/products/product-repository";
import { dashboardRoutes } from "@/lib/roles";
import { loadShopCatalogOnce } from "@/lib/shop-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/products">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "products" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard/products — Products (Part D8): what the shop sells or
 * buys, with cost, price and a live margin. Owner only. The Free plan keeps
 * 20 active products; Pro has no limit.
 */
export default function ProductsPage({ params }: PageProps<"/[locale]/dashboard/products">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProductsContent({ params }: Pick<PageProps<"/[locale]/dashboard/products">, "params">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { membership } = await requireDashboardPage(locale, dashboardRoutes.products);
  const supabase = await createSupabaseServerClient();
  const [t, catalog, companyNames, pro] = await Promise.all([
    getTranslations({ locale, namespace: "products" }),
    loadShopCatalogOnce(supabase, membership.business.id),
    new ProductRepository(supabase).companyNames(membership.business.id),
    // If the check fails the page treats the shop as Free; the database enforces the limit either way.
    supabase.rpc("is_pro").then((result) => result.data === true),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CurrencyProvider currency={membership.business.currency}>
        <ShopCatalogProvider categories={catalog.categories} products={catalog.products}>
          <ProductsView companyNames={companyNames} isPro={pro} />
        </ShopCatalogProvider>
      </CurrencyProvider>
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-[4.5rem] w-full rounded-2xl" />
      <Skeleton className="h-[4.5rem] w-full rounded-2xl" />
    </div>
  );
}
