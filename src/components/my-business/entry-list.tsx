"use client";

import { Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { Button } from "@/components/ui/button";
import type { Category } from "@/config/categories";
import { addDays, isoDateToDate, type IsoDate } from "@/lib/dates";
import type { BookEntry, DayGroup } from "@/lib/entries/entry-book";
import { cn } from "@/lib/utils";

/** What the list shows of one entry. */
export type ListEntry = BookEntry & { category: Category; note: string | null };

interface EntryListProps<Entry extends ListEntry> {
  days: readonly DayGroup<Entry>[];
  today: IsoDate;
  /** A stable key for an entry (its `clientId` here, its database id later). */
  entryKey: (entry: Entry) => string;
  onDelete: (entry: Entry) => void;
}

/**
 * Records grouped by day, newest first, with the profit of each day
 * (Part D2 "Entries list"). Income shows with +, expenses with −.
 */
export function EntryList<Entry extends ListEntry>({
  days,
  today,
  entryKey,
  onDelete,
}: EntryListProps<Entry>) {
  const t = useTranslations("myBusiness");
  const tEntry = useTranslations("entry");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const { money } = useCalcFormat();

  function dayLabel(date: IsoDate): string {
    if (date === today) return t("dayToday");
    if (date === addDays(today, -1)) return t("dayYesterday");
    return format.dateTime(isoDateToDate(date), {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
      timeZone: "UTC",
    });
  }

  return (
    <ol className="space-y-4">
      {days.map((day) => {
        const isLoss = day.totals.profitCents < 0;
        return (
          <li key={day.date} className="overflow-hidden rounded-2xl border bg-background">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-card px-4 py-3">
              <h3 className="font-semibold">
                {dayLabel(day.date)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {t("entryCount", { count: day.totals.count })}
                </span>
              </h3>
              <p className={cn("money text-sm font-semibold", isLoss ? "text-loss" : "text-profit")}>
                {isLoss
                  ? t("dayLoss", { amount: money(Math.abs(day.totals.profitCents)) })
                  : t("dayProfit", { amount: money(day.totals.profitCents) })}
              </p>
            </div>

            <ul className="divide-y">
              {day.entries.map((entry) => {
                const isIncome = entry.type === "income";
                const amount = money(entry.amountCents);
                return (
                  <li key={entryKey(entry)} className="flex items-center gap-3 py-2 pr-2 pl-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{tCategory(entry.category)}</p>
                      {entry.note && (
                        <p className="truncate text-sm text-muted-foreground">{entry.note}</p>
                      )}
                    </div>
                    <p
                      className={cn(
                        "money shrink-0 text-right font-semibold",
                        isIncome ? "text-profit" : "text-loss",
                      )}
                    >
                      {isIncome ? "+" : "−"}
                      {amount}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 text-muted-foreground hover:text-loss"
                      aria-label={tEntry("deleteLabel", {
                        category: tCategory(entry.category),
                        amount,
                      })}
                      onClick={() => onDelete(entry)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
