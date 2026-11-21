"use client";

import { ArrowRightIcon, InboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useQueuedEntries } from "@/components/offline/use-queued-entries";
import { useDateLabels } from "@/components/use-date-labels";
import { EntryList } from "@/components/my-business/entry-list";
import { TodaySummary } from "@/components/my-business/today-summary";
import { useToday } from "@/components/my-business/use-today";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { addDays, monthOf } from "@/lib/dates";
import { mergeQueuedEntries } from "@/lib/entries/display-entry";
import type { StoredEntry } from "@/lib/entries/entry";
import { EntryBook } from "@/lib/entries/entry-book";
import { dashboardRoutes } from "@/lib/roles";
import { AddButtons } from "./add-buttons";
import { useEntryDelete } from "./entry-delete-provider";

interface OwnerHomeProps {
  shopName: string;
  /** This month's and yesterday's entries (the server sends the last ~month). */
  entries: StoredEntry[];
}

/**
 * Owner home (Part C2 wireframe, Part D2 "Home (today)"): today's profit,
 * the change from yesterday, this month's profit, + Income / − Expense and
 * today's records. Empty state: "Add your first sale".
 *
 * "Today" is the phone's date, so the numbers are worked out in the browser
 * from the entries the server loaded, plus records still waiting on this
 * phone to be sent (added offline).
 */
export function OwnerHome({ shopName, entries }: OwnerHomeProps) {
  const t = useTranslations("ownerHome");
  const tBusiness = useTranslations("myBusiness");
  const dates = useDateLabels();
  const today = useToday();
  const queued = useQueuedEntries();
  // A record deleted on the Entries screen stays hidden here too while its Undo time runs.
  const { hiddenIds } = useEntryDelete();
  const rows = useMemo(
    () => mergeQueuedEntries(entries, queued).filter((entry) => !(entry.id && hiddenIds.has(entry.id))),
    [entries, queued, hiddenIds],
  );
  const book = useMemo(() => new EntryBook(rows), [rows]);

  if (today === null) return <OwnerHomeSkeleton />;

  const todayGroup = book.days().find((day) => day.date === today);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{shopName}</h1>
        <p className="text-sm text-muted-foreground">
          {dates.longDay(today)}
        </p>
      </header>

      <TodaySummary
        today={book.forDay(today)}
        yesterday={book.forDay(addDays(today, -1))}
        month={book.forMonth(monthOf(today))}
      />

      <AddButtons />

      <section aria-labelledby="today-records-title" className="space-y-3">
        {/* Wraps in Sinhala and Tamil, where the link text is long. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h2 id="today-records-title" className="text-lg font-semibold">
            {t("todayTitle")}
          </h2>
          {book.size > 0 && (
            <Button asChild variant="ghost" className="-mr-3 h-auto min-h-11 py-2 whitespace-normal">
              <Link href={dashboardRoutes.entries}>
                {t("allRecords")}
                <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
        {todayGroup ? (
          <EntryList days={[todayGroup]} today={today} entryKey={(entry) => entry.key} />
        ) : (
          <div className="rounded-2xl border border-dashed bg-background p-8 text-center">
            <InboxIcon aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">
              {book.size === 0 ? tBusiness("emptyTitle") : t("nothingToday")}
            </p>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("emptyBody")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function OwnerHomeSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
