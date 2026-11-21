"use client";

import { ClockIcon, LockIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { useDateLabels } from "@/components/use-date-labels";
import { Button } from "@/components/ui/button";
import { isHiddenCost, type Category } from "@/config/categories";
import { addDays, type IsoDate } from "@/lib/dates";
import type { BookEntry, DayGroup } from "@/lib/entries/entry-book";
import { cn } from "@/lib/utils";

/** What the list shows of one entry. */
export type ListEntry = BookEntry & {
  category: Category;
  note: string | null;
  /** Added offline: still waiting on this phone to be sent. */
  pending?: boolean;
  /** Cannot be changed by this person (Staff: only today's entries, Part C1.3). */
  locked?: boolean;
};

interface EntryListProps<Entry extends ListEntry> {
  days: readonly DayGroup<Entry>[];
  today: IsoDate;
  /** A stable key for an entry (its `clientId` here, its database id later). */
  entryKey: (entry: Entry) => string;
  /** Makes each row a button that opens the edit sheet. Leave out for a read-only list. */
  onSelect?: (entry: Entry) => void;
  /** Shows a delete button on each entry. Leave out when deleting happens in the edit sheet. */
  onDelete?: (entry: Entry) => void;
  /** Show each day's profit. Staff never see profit (Part B3), so they turn it off. */
  showDayProfit?: boolean;
}

/**
 * Records grouped by day, newest first, with the profit of each day
 * (Part D2 "Entries list", Part E3 "EntryRow"). Income shows with +, expenses
 * with −. Entries waiting to be sent show a clock, locked ones a lock.
 */
export function EntryList<Entry extends ListEntry>({
  days,
  today,
  entryKey,
  onSelect,
  onDelete,
  showDayProfit = true,
}: EntryListProps<Entry>) {
  const t = useTranslations("myBusiness");
  const tEntry = useTranslations("entry");
  const tEntries = useTranslations("entries");
  const tCategory = useTranslations("categories");
  const dates = useDateLabels();
  const { money } = useCalcFormat();

  function dayLabel(date: IsoDate): string {
    if (date === today) return t("dayToday");
    if (date === addDays(today, -1)) return t("dayYesterday");
    return dates.shortDay(date, date.slice(0, 4) !== today.slice(0, 4));
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
              {showDayProfit && (
                <p className={cn("money text-sm font-semibold", isLoss ? "text-loss" : "text-profit")}>
                  {isLoss
                    ? t("dayLoss", { amount: money(Math.abs(day.totals.profitCents)) })
                    : t("dayProfit", { amount: money(day.totals.profitCents) })}
                </p>
              )}
            </div>

            <ul className="divide-y">
              {day.entries.map((entry) => {
                const isIncome = entry.type === "income";
                const amount = money(entry.amountCents);
                const category = tCategory(entry.category);
                // A waiting entry is not in the account yet, so it cannot be changed here.
                const canSelect = Boolean(onSelect) && !entry.locked && !entry.pending;

                const content = (
                  <>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="font-medium">{category}</p>
                      {entry.type === "expense" && isHiddenCost(entry.category) && (
                        <p className="text-xs text-muted-foreground">{tEntries("hiddenCost")}</p>
                      )}
                      {entry.pending && (
                        <p className="flex items-center gap-1 text-xs font-medium text-warning-foreground">
                          <ClockIcon aria-hidden="true" className="size-3.5" />
                          {tEntries("pending")}
                        </p>
                      )}
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
                    {entry.locked && (
                      <LockIcon
                        role="img"
                        aria-label={tEntries("locked")}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    )}
                  </>
                );
                const rowClass = "flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4";

                return (
                  <li key={entryKey(entry)} className="flex items-center">
                    {canSelect ? (
                      <button
                        type="button"
                        aria-label={tEntries("edit", { category, amount })}
                        onClick={() => onSelect?.(entry)}
                        className={cn(
                          rowClass,
                          "pr-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                        )}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={cn(rowClass, "pr-4", onDelete && "pr-2")}>{content}</div>
                    )}
                    {onDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mr-2 size-11 shrink-0 text-muted-foreground hover:text-loss"
                        aria-label={tEntry("deleteLabel", { category, amount })}
                        onClick={() => onDelete(entry)}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    )}
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
