"use client";

import { ChevronLeftIcon, ChevronRightIcon, InboxIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { useEntryDelete } from "@/components/dashboard/entry-delete-provider";
import { useQueuedEntries } from "@/components/offline/use-queued-entries";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { firstDayOfMonth, isoDateToDate, monthOf, shiftMonth } from "@/lib/dates";
import { mergeQueuedEntries, type DisplayEntry } from "@/lib/entries/display-entry";
import {
  ALL_CATEGORIES,
  CATEGORIES_BY_TYPE,
  isCategoryOf,
  type EntryType,
  type StoredEntry,
} from "@/lib/entries/entry";
import { EntryBook } from "@/lib/entries/entry-book";
import { entryFiltersToQuery, matchesFilters, type EntryFilters } from "@/lib/entries/entry-filters";
import { can, dashboardRoutes, type MemberRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { Category } from "@/config/categories";
import { CHIP_CLASS } from "./chip-group";
import { EditEntrySheet } from "./edit-entry-sheet";
import { EntryList, type ListEntry } from "./entry-list";
import { useToday } from "./use-today";

interface EntriesViewProps {
  role: MemberRole;
  /** The month's entries from the server, newest first. */
  entries: StoredEntry[];
  filters: EntryFilters;
  /** The month the page opens on, which the address leaves out. */
  defaultMonth: string;
  /** The month has more entries than one page holds. */
  truncated: boolean;
}

/** An entry as the list shows it, with the lock for Staff. */
type RowEntry = DisplayEntry & ListEntry;

/**
 * The Entries screen (Part D2 "Entries list"): one month at a time with
 * month arrows, filters for type and category, records grouped by day with
 * the profit of each day, an edit sheet, and delete with a confirm question
 * and a 5-second Undo.
 *
 * Owners and Staff can change entries (Staff: only their own from today, which
 * is all the database shows them); Viewers can only read. Records added
 * offline that are still waiting to be sent appear in the list too.
 */
export function EntriesView({ role, entries, filters, defaultMonth, truncated }: EntriesViewProps) {
  const t = useTranslations("entries");
  const tEntry = useTranslations("entry");
  const tBusiness = useTranslations("myBusiness");
  const tCalc = useTranslations("calcUi");
  const format = useFormatter();
  const { money } = useCalcFormat();
  const today = useToday();
  const queued = useQueuedEntries();

  const [editing, setEditing] = useState<DisplayEntry | null>(null);
  // Records deleted on screen that wait out their 5 seconds of Undo (shared by all screens).
  const { hiddenIds, requestDelete } = useEntryDelete();

  const showTotals = can(role, "seeTotals");
  const canEdit = can(role, "editEntry");

  const rows = useMemo(() => {
    const waiting = queued.filter((entry) => matchesFilters(entry, filters));
    return mergeQueuedEntries(entries, waiting)
      .filter((entry) => !(entry.id && hiddenIds.has(entry.id)))
      .map(
        (entry): RowEntry => ({
          ...entry,
          // Staff may only change today's entries (Part C1.3).
          locked: role === "staff" && today !== null && entry.entryDate !== today,
        }),
      );
  }, [entries, queued, filters, hiddenIds, role, today]);
  const book = useMemo(() => new EntryBook(rows), [rows]);

  // ---------------------------------------------------------------- delete + Undo

  function deleteWithUndo(entry: DisplayEntry) {
    if (!entry.id) return;
    setEditing(null);
    requestDelete(entry.id);
  }
  // ---------------------------------------------------------------------- screen

  if (today === null) return <EntriesSkeleton />;

  const hasFilters = Boolean(filters.type || filters.category);
  const monthLabel = format.dateTime(isoDateToDate(firstDayOfMonth(filters.month)), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const linkTo = (next: EntryFilters) =>
    `${dashboardRoutes.entries}${entryFiltersToQuery(next, defaultMonth)}`;
  const totals = book.size > 0 ? EntryBook.total(rows) : null;
  const isLoss = (totals?.profitCents ?? 0) < 0;

  return (
    <div className="space-y-5">
      {/* Month arrows */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-background p-1.5">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link
            href={linkTo({ ...filters, month: shiftMonth(filters.month, -1) })}
            aria-label={t("previousMonth")}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
        </Button>
        <h2 aria-live="polite" className="text-lg font-semibold">
          {monthLabel}
        </h2>
        {filters.month < monthOf(today) ? (
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link
              href={linkTo({ ...filters, month: shiftMonth(filters.month, 1) })}
              aria-label={t("nextMonth")}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span aria-hidden="true" className="size-11" />
        )}
      </div>

      {/* Filters: type, then category */}
      <div className="space-y-3">
        <FilterRow label={t("filterType")}>
          <FilterChip
            href={linkTo({ ...filters, type: null, category: null })}
            active={!filters.type}
          >
            {t("all")}
          </FilterChip>
          {(["income", "expense"] as const).map((type) => (
            <FilterChip
              key={type}
              href={linkTo({ ...filters, type, category: keepCategory(filters.category, type) })}
              active={filters.type === type}
            >
              {tEntry(type)}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label={t("filterCategory")}>
          <FilterChip href={linkTo({ ...filters, category: null })} active={!filters.category}>
            {t("allCategories")}
          </FilterChip>
          {(filters.type ? CATEGORIES_BY_TYPE[filters.type] : ALL_CATEGORIES).map((key) => (
            <FilterChip
              key={key}
              href={linkTo({ ...filters, category: key })}
              active={filters.category === key}
            >
              <CategoryLabel category={key} />
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      {/* Month totals (Staff never see totals, Part B3) */}
      {showTotals && totals && (
        <dl
          aria-label={monthLabel}
          className="grid grid-cols-3 divide-x rounded-2xl border bg-background"
        >
          <Stat label={tBusiness("income")} value={money(totals.incomeCents)} />
          <Stat label={tBusiness("expenses")} value={money(totals.expenseCents)} />
          <Stat
            label={isLoss ? tCalc("loss") : tCalc("profit")}
            value={money(Math.abs(totals.profitCents))}
            tone={isLoss ? "loss" : "profit"}
          />
        </dl>
      )}

      {truncated && (
        <p className="rounded-xl bg-warning/10 p-3 text-sm text-pretty">{t("truncated")}</p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background p-8 text-center">
          <InboxIcon aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{hasFilters ? t("emptyFiltered") : t("emptyMonth")}</p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {hasFilters && (
              <Button asChild variant="outline" className="h-auto min-h-11 bg-background py-2 whitespace-normal">
                <Link href={linkTo({ ...filters, type: null, category: null })}>{t("clearFilters")}</Link>
              </Button>
            )}
            {can(role, "addEntry") && (
              <Button asChild className="h-auto min-h-11 py-2 whitespace-normal">
                <Link href={dashboardRoutes.add}>
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  {t("addRecord")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <EntryList
          days={book.days()}
          today={today}
          entryKey={(entry) => entry.key}
          onSelect={canEdit ? setEditing : undefined}
          showDayProfit={showTotals}
        />
      )}

      <EditEntrySheet
        entry={editing}
        role={role}
        today={today}
        onClose={() => setEditing(null)}
        onDelete={deleteWithUndo}
      />
    </div>
  );
}

/** A category chosen earlier stays chosen only if it fits the new type. */
function keepCategory(category: Category | null, type: EntryType): Category | null {
  return category && isCategoryOf(type, category) ? category : null;
}

function CategoryLabel({ category }: { category: Category }) {
  const t = useTranslations("categories");
  return <>{t(category)}</>;
}

/** A labelled row of filter chips; scrolls sideways on small phones. */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {children}
      </div>
    </div>
  );
}

/** A filter chip. A real link, so it works without JavaScript and the address keeps the filter. */
function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        CHIP_CLASS,
        "shrink-0 whitespace-nowrap",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="min-w-0 space-y-1 px-3 py-3">
      <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
      <dd
        className={cn(
          "money text-sm font-semibold break-all sm:text-base",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EntriesSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
