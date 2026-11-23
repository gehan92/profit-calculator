import { isDefaultKey } from "@/config/categories";
import { hasCategoryRefShape, isCategoryId } from "@/lib/categories/category";
import { firstDayOfMonth, isMonth, monthOf, shiftMonth, type IsoDate } from "@/lib/dates";
import { ENTRY_TYPES, type EntryFields, type EntryType } from "./entry";

/**
 * What the Entries list shows (Part D2 "Entries list"): one month, and
 * optionally one type and one category. They live in the page address
 * (`?month=2026-11&type=expense&category=<id>`), so a filtered list can be
 * reopened or shared, and the server loads only what is needed. The category
 * is a reference: the category's id, or a default key such as `stock` (older links).
 */
export interface EntryFilters {
  /** "2026-11". */
  month: string;
  type: EntryType | null;
  /** A category id, or a default key; `null` = all categories. */
  category: string | null;
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
  const validCategory = category !== undefined && hasCategoryRefShape(category) ? category : null;

  return {
    month: month && isMonth(month) ? month : defaultMonth,
    type: validType,
    // A default key that does not fit the chosen type would match nothing: drop it.
    // (An id cannot be checked here: the database only returns what belongs to the shop.)
    category:
      validCategory && (isCategoryId(validCategory) || !validType || isDefaultKey(validType, validCategory))
        ? validCategory
        : null,
  };
}

/**
 * The month from a page address (`?month=2026-10`), or `fallback` when it is
 * missing or not a real month. The Summary page uses it.
 */
export function parseMonthParam(param: Param, fallback: string): string {
  const month = first(param);
  return month && isMonth(month) ? month : fallback;
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

/**
 * True if an entry belongs in a list with these filters. `canonical` turns a
 * category reference into one form (an id and a default key can name the same
 * category); the default compares them as they are.
 */
export function matchesFilters(
  entry: Pick<EntryFields, "type" | "category" | "entryDate">,
  filters: EntryFilters,
  canonical: (category: string, type: EntryType) => string = (category) => category,
): boolean {
  return (
    monthOf(entry.entryDate) === filters.month &&
    (!filters.type || entry.type === filters.type) &&
    (!filters.category || canonical(entry.category, entry.type) === canonical(filters.category, entry.type))
  );
}
