"use client";

import { InboxIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import { EntryList } from "@/components/my-business/entry-list";
import { TodaySummary } from "@/components/my-business/today-summary";
import { useToday } from "@/components/my-business/use-today";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, isoDateToDate, monthOf } from "@/lib/dates";
import { EntryBook } from "@/lib/entries/entry-book";
import type { StoredEntry } from "@/lib/entries/entry-repository";
import { AddButtons } from "./add-buttons";

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
 * from the entries the server loaded.
 */
export function OwnerHome({ shopName, entries }: OwnerHomeProps) {
  const t = useTranslations("ownerHome");
  const tBusiness = useTranslations("myBusiness");
  const format = useFormatter();
  const today = useToday();
  const book = useMemo(() => new EntryBook(entries), [entries]);

  if (today === null) return <OwnerHomeSkeleton />;

  const todayGroup = book.days().find((day) => day.date === today);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{shopName}</h1>
        <p className="text-sm text-muted-foreground">
          {format.dateTime(isoDateToDate(today), {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </p>
      </header>

      <TodaySummary
        today={book.forDay(today)}
        yesterday={book.forDay(addDays(today, -1))}
        month={book.forMonth(monthOf(today))}
      />

      <AddButtons />

      <section aria-labelledby="today-records-title" className="space-y-3">
        <h2 id="today-records-title" className="text-lg font-semibold">
          {t("todayTitle")}
        </h2>
        {todayGroup ? (
          <EntryList days={[todayGroup]} today={today} entryKey={(entry) => entry.id} />
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
