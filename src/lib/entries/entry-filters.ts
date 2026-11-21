import type { Category } from "@/config/categories";
import { firstDayOfMonth, isMonth, monthOf, shiftMonth, type IsoDate } from "@/lib/dates";
import {
  ALL_CATEGORIES,
  ENTRY_TYPES,
  isCategoryOf,
  type EntryFields,
  type EntryType,
} from "./entry";

/**
 * What the Entries list shows (Part D2 "Entries list"): one month, and
 * optionally one type and one category. They live in the page address
 * (`?month=2026-11&type=expense&category=stock`), so a filtered list can be
 * reopened or shared, and the server loads only what is needed.
 */
export interface EntryFilters {
  /** "2026-11". */
  month: string;
  type: EntryType | null;
  category: Category | null;
}

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads filters from the page address. Anything unknown is ignored, so a
 * hand-typed or old link never breaks the page. `defaultMonth` is used
 * when the address has no valid month.
 */
export function parseEntryFilters(
  params: { month?: Param; type?: Param; category?: Param },
  defaultMonth: string,
): EntryFilters {
  const month = first(params.month);
  const type = first(params.type);
  const category = first(params.category);

  const validType = (ENTRY_TYPES as readonly string[]).includes(type ?? "")
    ? (type as EntryType)
    : null;
  const validCategory = (ALL_CATEGORIES as readonly string[]).includes(category ?? "")
    ? (category as Category)
    : null;

  return {
    month: month && isMonth(month) ? month : defaultMonth,
    type: validType,
    // A category that does not fit the chosen type would match nothing: drop it.
    category: validCategory && (!validType || isCategoryOf(validType, validCategory)) ? validCategory : null,
  };
}

/** The address query for these filters. The default month is left out. */
export function entryFiltersToQuery(filters: EntryFilters, defaultMonth: string): string {
  const query = new URLSearchParams();
  if (filters.month !== defaultMonth) query.set("month", filters.month);
  if (filters.type) query.set("type", filters.type);
  if (filters.category) query.set("category", filters.category);
  const text = query.toString();
  return text ? `?${text}` : "";
}

/** First day of the month and the first day of the next one, for a "from … before …" query. */
export function monthRange(month: string): { from: IsoDate; before: IsoDate } {
  return { from: firstDayOfMonth(month), before: firstDayOfMonth(shiftMonth(month, 1)) };
}

/** True if an entry belongs in a list with these filters. */
export function matchesFilters(
  entry: Pick<EntryFields, "type" | "category" | "entryDate">,
  filters: EntryFilters,
): boolean {
  return (
    monthOf(entry.entryDate) === filters.month &&
    (!filters.type || entry.type === filters.type) &&
    (!filters.category || entry.category === filters.category)
  );
}
