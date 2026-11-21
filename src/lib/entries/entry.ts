import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Category,
} from "@/config/categories";
import { addDays, isIsoDate, utcIsoDate, type IsoDate } from "@/lib/dates";

/**
 * One income or expense (Part D2 "Add entry", Part F3 `entries`), with the
 * rules shared by the browser and the server:
 * amount > 0 with up to 2 decimals (whole cents), a category that fits the
 * type, a real date and a note of at most 200 characters.
 */

export const ENTRY_TYPES = ["income", "expense"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_NOTE_MAX_LENGTH = 200;

/** 12 whole digits (the amount field's limit) plus cents; still an exact JavaScript number. */
export const MAX_AMOUNT_CENTS = 99_999_999_999_999;

/** How long the Undo button stays after deleting an entry (Part D2: "5-second Undo"). */
export const DELETE_UNDO_SECONDS = 5;

/**
 * Most entries one "import" request carries. The browser sends bigger piles
 * in batches; 500 entries with long notes still fit Next.js's 1 MB action limit.
 */
export const IMPORT_BATCH_SIZE = 500;

/** Older dates are surely typing mistakes. */
export const EARLIEST_ENTRY_DATE = "2000-01-01";

/** Which categories each type offers, in display order (Part D2). */
export const CATEGORIES_BY_TYPE = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
} as const satisfies Record<EntryType, readonly Category[]>;

/** The chip chosen first: most entries are sales, and most costs are stock. */
export const DEFAULT_CATEGORY = {
  income: "sales",
  expense: "stock",
} as const satisfies Record<EntryType, Category>;

/** Every category key, income first. */
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] as const;

/**
 * The latest entry date the server accepts ("no future dates", Part F5).
 * The server doesn't know the phone's timezone, so it allows one day ahead
 * of UTC (Sri Lanka is UTC+5:30; the furthest timezone is UTC+14).
 */
export function latestEntryDate(now: Date = new Date()): IsoDate {
  return addDays(utcIsoDate(now), 1);
}

export function isCategoryOf(type: EntryType, category: string): boolean {
  return (CATEGORIES_BY_TYPE[type] as readonly string[]).includes(category);
}

const entryShape = {
  type: z.enum(ENTRY_TYPES),
  category: z.enum(ALL_CATEGORIES),
  amountCents: z.number().int().positive().max(MAX_AMOUNT_CENTS),
  entryDate: z
    .string()
    .refine(isIsoDate, "invalidDate")
    .refine((date) => date >= EARLIEST_ENTRY_DATE, "invalidDate"),
  note: z
    .string()
    .trim()
    .max(ENTRY_NOTE_MAX_LENGTH, "noteTooLong")
    .nullable()
    .transform((note) => note || null),
};

/** "Sales" is income and "Stock" is an expense: never the other way round. */
function categoryFitsType(entry: { type: EntryType; category: Category }): boolean {
  return isCategoryOf(entry.type, entry.category);
}
const CATEGORY_MISMATCH = { message: "categoryMismatch", path: ["category"] };

/** What a person fills in on the Add entry form. */
export const entryFieldsSchema = z.object(entryShape).refine(categoryFitsType, CATEGORY_MISMATCH);

export type EntryFields = z.output<typeof entryFieldsSchema>;

/**
 * An entry made in the browser before it reaches the server (guest mode now,
 * the offline queue on Day 9). `clientId` is sent along and stored in
 * `entries.client_id`, so sending the same entry twice never saves it twice.
 */
export const clientEntrySchema = z
  .object({ ...entryShape, clientId: z.uuid(), createdAt: z.iso.datetime() })
  .refine(categoryFitsType, CATEGORY_MISMATCH);

export type ClientEntry = z.output<typeof clientEntrySchema>;

/** An entry as stored in the database, in the shape screens use. */
export interface StoredEntry extends EntryFields {
  id: string;
  createdAt: string;
  /** Set when the entry came from guest mode or the offline queue; `null` when added online. */
  clientId: string | null;
}
