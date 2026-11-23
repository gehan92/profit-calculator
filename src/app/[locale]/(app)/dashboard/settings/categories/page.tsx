import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShopCatalogProvider } from "@/components/shop-catalog-context";
import { CategoriesManager } from "@/components/settings/categories-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireDashboardPage } from "@/lib/auth/dashboard-access";
import { dashboardRoutes } from "@/lib/roles";
import { loadShopCatalogOnce } from "@/lib/shop-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/settings/categories">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "categoryManager" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard/settings/categories — Settings → Categories (Part D9):
 * add, rename, hide and reorder the kinds of money in and out, and mark hidden
 * costs. Owner only.
 */
export default function CategoriesPage({ params }: PageProps<"/[locale]/dashboard/settings/categories">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContent params={params} />
      </Suspense>
    </div>
  );
}

async function CategoriesContent({ params }: Pick<PageProps<"/[locale]/dashboard/settings/categories">, "params">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { membership } = await requireDashboardPage(locale, dashboardRoutes.categories);
  const [t, catalog] = await Promise.all([
    getTranslations({ locale, namespace: "categoryManager" }),
    createSupabaseServerClient().then((supabase) => loadShopCatalogOnce(supabase, membership.business.id)),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={dashboardRoutes.settings}
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {t("back")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ShopCatalogProvider categories={catalog.categories} products={catalog.products}>
        <CategoriesManager />
      </ShopCatalogProvider>
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}
