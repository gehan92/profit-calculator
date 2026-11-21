import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntriesView } from "@/components/my-business/entries-view";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { requireDashboardPage } from "@/lib/auth/dashboard-access";
import { monthOf, utcIsoDate } from "@/lib/dates";
import { parseEntryFilters } from "@/lib/entries/entry-filters";
import { EntryRepository } from "@/lib/entries/entry-repository";
import { dashboardRoutes } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/entries">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "appNav" });
  return { title: t("entries"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/dashboard/entries — the Entries list (Part D2): Owner (change),
 * Staff ("My entries", their own from today) and Viewer (read only).
 * The month, type and category come from the address, so a filtered list can
 * be reopened or shared, and the database returns only what is shown.
 */
export default function EntriesPage({ params, searchParams }: PageProps<"/[locale]/dashboard/entries">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<EntriesPageSkeleton />}>
        <EntriesContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EntriesContent({ params, searchParams }: PageProps<"/[locale]/dashboard/entries">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { membership } = await requireDashboardPage(locale, dashboardRoutes.entries);
  const t = await getTranslations({ locale, namespace: "appNav" });

  // The server does not know the phone's calendar: it opens on the current UTC month,
  // and the month arrows reach any other.
  const defaultMonth = monthOf(utcIsoDate());
  const filters = parseEntryFilters(await searchParams, defaultMonth);

  const supabase = await createSupabaseServerClient();
  const { entries, truncated } = await new EntryRepository(supabase).listMonth(
    membership.business.id,
    filters,
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        {membership.role === "staff" ? t("myEntries") : t("entries")}
      </h1>
      <EntriesView
        role={membership.role}
        entries={entries}
        filters={filters}
        defaultMonth={defaultMonth}
        truncated={truncated}
      />
    </div>
  );
}

function EntriesPageSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
