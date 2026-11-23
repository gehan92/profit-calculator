import { z } from "zod";
import { margin, type MarginResult } from "@/lib/calc";
import { MAX_AMOUNT_CENTS, type EntryType } from "@/lib/entries/entry";

/**
 * Products (Part D8): what a shop sells or buys, with its cost, price and a
 * live margin. "Made by my shop" (a cake) or "from a company" (a biscuit
 * packet), so the owner can see which suppliers' goods earn the most.
 */

export const PRODUCT_KINDS = ["own", "company"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** The units the database accepts (`products.unit`). */
export const PRODUCT_UNITS = [
  "piece",
  "kg",
  "g",
  "litre",
  "ml",
  "pack",
  "box",
  "bottle",
  "dozen",
  "metre",
  "service",
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

/** The Free plan keeps up to 20 active products; Pro has no limit (Part D8). */
export const FREE_PRODUCT_LIMIT = 20;

export const PRODUCT_NAME_MAX = 80;
export const COMPANY_NAME_MAX = 80;
export const PRODUCT_BARCODE_MAX = 40;
export const PRODUCT_NOTES_MAX = 200;

/** A product as the screens use it. */
export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  /** Only for products from a company. */
  companyName: string | null;
  unit: ProductUnit;
  /** What one unit costs the shop. */
  costCents: number;
  /** What one unit is sold for. */
  priceCents: number;
  barcode: string | null;
  notes: string | null;
  /** Put away: not offered in Add entry, but old entries keep its name. */
  archived: boolean;
}

/** What the owner fills in on the product form. */
export const productFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(PRODUCT_NAME_MAX, "nameTooLong"),
    kind: z.enum(PRODUCT_KINDS),
    companyName: z
      .string()
      .trim()
      .max(COMPANY_NAME_MAX, "companyTooLong")
      .nullable()
      .transform((value) => value || null),
    unit: z.enum(PRODUCT_UNITS),
    costCents: z.number().int().min(0, "invalidAmount").max(MAX_AMOUNT_CENTS, "invalidAmount"),
    priceCents: z.number().int().min(0, "invalidAmount").max(MAX_AMOUNT_CENTS, "invalidAmount"),
    barcode: z
      .string()
      .trim()
      .max(PRODUCT_BARCODE_MAX, "barcodeTooLong")
      .nullable()
      .transform((value) => value || null),
    notes: z
      .string()
      .trim()
      .max(PRODUCT_NOTES_MAX, "notesTooLong")
      .nullable()
      .transform((value) => value || null),
  })
  .refine((fields) => fields.kind === "own" || fields.companyName !== null, {
    message: "companyRequired",
    path: ["companyName"],
  })
  // A product made by the shop has no company: the name would only confuse the suggestions.
  .transform((fields) => (fields.kind === "own" ? { ...fields, companyName: null } : fields));

export type ProductFields = z.output<typeof productFieldsSchema>;

/** Profit per unit, margin % and markup % at the product's own cost and price (Part D1 margin rules). */
export function productMargin(product: Pick<Product, "costCents" | "priceCents">): MarginResult {
  return margin(product.costCents, product.priceCents);
}

/**
 * What one unit adds up to in Add entry: a sale uses the selling price, a
 * purchase the cost. The amount then fills in as price × quantity.
 */
export function unitAmountCents(product: Pick<Product, "costCents" | "priceCents">, type: EntryType): number {
  return type === "income" ? product.priceCents : product.costCents;
}

/** Price × quantity in whole cents (quantity may have up to 3 decimals). */
export function lineAmountCents(unitCents: number, quantity: number): number {
  return Math.round(unitCents * quantity);
}

/** How a margin reads in colour: loss, thin or healthy (used for the badge on the product list). */
export type MarginHealth = "loss" | "thin" | "good" | "unknown";

export function marginHealth(product: Pick<Product, "costCents" | "priceCents">): MarginHealth {
  const { marginPct } = productMargin(product);
  if (marginPct === null) return "unknown";
  if (marginPct < 0) return "loss";
  return marginPct < 10 ? "thin" : "good";
}

/** Products from the same company, grouped for the "From company" tab (A–Z, "no company" last). */
export function groupByCompany<Item extends Pick<Product, "companyName">>(items: readonly Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.companyName ?? "";
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return new Map([...groups.entries()].toSorted(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b))));
}

/** The names that start with what was typed (case-insensitive), for the company suggestions. */
export function suggestCompanies(names: readonly string[], typed: string, limit = 6): string[] {
  const needle = typed.trim().toLowerCase();
  if (needle === "") return [];
  return names
    .filter((name) => name.toLowerCase().includes(needle) && name.toLowerCase() !== needle)
    .toSorted((a, b) => Number(b.toLowerCase().startsWith(needle)) - Number(a.toLowerCase().startsWith(needle)) || a.localeCompare(b))
    .slice(0, limit);
}
