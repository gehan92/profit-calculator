import type { Category } from "@/config/categories";
import { CsvDocument } from "@/lib/csv";
import { Money, type CurrencyCode } from "@/lib/money";
import type { EntryType, StoredEntry } from "./entry";

/** Column headings and words, in the person's language (messages/*.json → settings.csvColumns). */
export interface EntryCsvLabels {
  columns: {
    date: string;
    type: string;
    category: string;
    amount: string;
    currency: string;
    note: string;
    addedAt: string;
  };
  type: (type: EntryType) => string;
  category: (category: Category) => string;
}

/**
 * The records of a shop as a CSV file (Part D2 Settings "export CSV"):
 * one row per entry in the order given (oldest first), with a plain decimal
 * amount ("1500.50") that a spreadsheet reads as a number.
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
    columns.amount,
    columns.currency,
    columns.note,
    columns.addedAt,
  ]);

  for (const entry of entries) {
    csv.addRow([
      entry.entryDate,
      labels.type(entry.type),
      labels.category(entry.category),
      CsvDocument.number(Money.fromCents(entry.amountCents, currency).toDecimalString()),
      currency,
      entry.note ?? "",
      entry.createdAt,
    ]);
  }
  return csv.toString();
}
