import { CsvDocument } from "@/lib/csv";
import { Money, type CurrencyCode } from "@/lib/money";
import type { EntryType, StoredEntry } from "./entry";

/** Column headings and words, in the person's language (messages/*.json → settings.csvColumns). */
export interface EntryCsvLabels {
  columns: {
    date: string;
    type: string;
    category: string;
    product: string;
    quantity: string;
    amount: string;
    currency: string;
    note: string;
    addedAt: string;
  };
  /** How the Date column is written, e.g. "2026-11-23" or "23/11/2026" (the person's choice on the Account page). */
  date: (isoDate: string) => string;
  type: (type: EntryType) => string;
  /** The name of an entry's category (its own name, or the translated default). */
  category: (entry: StoredEntry) => string;
  /** The name of an entry's product; empty when it has none. */
  product: (entry: StoredEntry) => string;
}

/**
 * The records of a shop as a CSV file (Part D2 Settings "export CSV"):
 * one row per entry in the order given (oldest first), with the category and
 * product names, the quantity, and a plain decimal amount ("1500.50") that a
 * spreadsheet reads as a number.
 */
export function buildEntriesCsv(
  entries: readonly StoredEntry[],
  currency: CurrencyCode,
  labels: EntryCsvLabels,
): string {
  const { columns } = labels;
  const csv = new CsvDocument().addRow([
    columns.date,
    columns.type,
    columns.category,
    columns.product,
    columns.quantity,
    columns.amount,
    columns.currency,
    columns.note,
    columns.addedAt,
  ]);

  for (const entry of entries) {
    csv.addRow([
      labels.date(entry.entryDate),
      labels.type(entry.type),
      labels.category(entry),
      labels.product(entry),
      entry.quantity === null ? "" : CsvDocument.number(String(entry.quantity)),
      CsvDocument.number(Money.fromCents(entry.amountCents, currency).toDecimalString()),
      currency,
      entry.note ?? "",
      entry.createdAt,
    ]);
  }
  return csv.toString();
}
