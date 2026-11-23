import { z } from "zod";
import { isDefaultKey } from "@/config/categories";
import { hasCategoryRefShape, isCategoryId } from "@/lib/categories/category";
import { addDays, isIsoDate, utcIsoDate, type IsoDate } from "@/lib/dates";

/**
 * One income or expense (Part D2 "Add entry", Part F3 `entries`), with the
 * rules shared by the browser and the server:
 * amount > 0 with up to 2 decimals (whole cents), a category, a real date, a
 * note of at most 200 characters, and optionally a product with its quantity.
 *
 * The category is a *reference*: the shop's category id, or a default key
 * ('stock') for guest records and entries queued offline. The database turns
 * a key into the shop's category and checks that the category belongs to the
 * shop and fits the type; here a key is checked against the default list.
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

/** The most of one product a single entry can count (a decimal such as 1.5 kg is fine). */
export const MAX_QUANTITY = 999_999;

/**
 * The latest entry date the server accepts ("no future dates", Part F5).
 * The server doesn't know the phone's timezone, so it allows one day ahead
 * of UTC (Sri Lanka is UTC+5:30; the furthest timezone is UTC+14).
 */
export function latestEntryDate(now: Date = new Date()): IsoDate {
  return addDays(utcIsoDate(now), 1);
}

/** Quantities have at most 3 decimals, like the database column. */
function hasAtMostThreeDecimals(quantity: number): boolean {
  return Math.abs(Math.round(quantity * 1000) - quantity * 1000) < 1e-6;
}

const entryShape = {
  type: z.enum(ENTRY_TYPES),
  category: z.string().refine(hasCategoryRefShape, "invalidCategory"),
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
  /** The product sold or bought (Part D8); older records have none. */
  productId: z.uuid().nullable().default(null),
  /** How many of it; always together with a product. */
  quantity: z
    .number()
    .positive()
    .max(MAX_QUANTITY)
    .refine(hasAtMostThreeDecimals, "invalidQuantity")
    .nullable()
    .default(null),
};

type ShapeInput = { type: EntryType; category: string; productId: string | null; quantity: number | null };

/**
 * A default key ("sales") must be one of the default categories of that kind:
 * "Sales" is income and "Stock" is an expense, never the other way round. An
 * id cannot be checked here; the database checks it belongs to this shop.
 */
function categoryFitsType(entry: ShapeInput): boolean {
  return isCategoryId(entry.category) || isDefaultKey(entry.type, entry.category);
}
const CATEGORY_MISMATCH = { message: "categoryMismatch", path: ["category"] };

function productMatchesQuantity(entry: ShapeInput): boolean {
  return (entry.productId === null) === (entry.quantity === null);
}
const PRODUCT_QUANTITY = { message: "quantityRequired", path: ["quantity"] };

/** What a person fills in on the Add entry form. */
export const entryFieldsSchema = z
  .object(entryShape)
  .refine(categoryFitsType, CATEGORY_MISMATCH)
  .refine(productMatchesQuantity, PRODUCT_QUANTITY);

export type EntryFields = z.output<typeof entryFieldsSchema>;

/**
 * An entry made in the browser before it reaches the server (guest mode now,
 * the offline queue on Day 9). `clientId` is sent along and stored in
 * `entries.client_id`, so sending the same entry twice never saves it twice.
 */
export const clientEntrySchema = z
  .object({ ...entryShape, clientId: z.uuid(), createdAt: z.iso.datetime() })
  .refine(categoryFitsType, CATEGORY_MISMATCH)
  .refine(productMatchesQuantity, PRODUCT_QUANTITY);

export type ClientEntry = z.output<typeof clientEntrySchema>;

/** An entry as stored in the database, in the shape screens use. */
export interface StoredEntry extends EntryFields {
  id: string;
  createdAt: string;
  /** Set when the entry came from guest mode or the offline queue; `null` when added online. */
  clientId: string | null;
}
