import { monthOf, type IsoDate } from "@/lib/dates";
import type { EntryFields } from "./entry";

/** Money in and out for some entries. Profit = Income − Expenses (Part D1). */
export interface Totals {
  incomeCents: number;
  expenseCents: number;
  profitCents: number;
  count: number;
}

/** The fields a book needs from an entry; works for local and database entries alike. */
export type BookEntry = Pick<EntryFields, "type" | "amountCents" | "entryDate"> & {
  /** ISO time it was added, used to show the newest first within a day. */
  createdAt: string;
};

export interface DayGroup<Entry extends BookEntry> {
  date: IsoDate;
  totals: Totals;
  /** Newest first. */
  entries: Entry[];
}

/**
 * Adds up a list of entries by day and by month: today's profit, the month's
 * profit and the "grouped by day, newest first, daily profit per day" list
 * (Part D2 "Home (today)" and "Entries list").
 *
 * Used by guest mode now and by the Owner screens from Day 8.
 */
export class EntryBook<Entry extends BookEntry> {
  constructor(private readonly entries: readonly Entry[]) {}

  get size(): number {
    return this.entries.length;
  }

  /** Totals for one day, e.g. today. */
  forDay(date: IsoDate): Totals {
    return EntryBook.total(this.entries.filter((entry) => entry.entryDate === date));
  }

  /** Totals for one month, e.g. "2026-11". */
  forMonth(month: string): Totals {
    return EntryBook.total(this.entries.filter((entry) => monthOf(entry.entryDate) === month));
  }

  /** Every day that has entries, newest day first. */
  days(): DayGroup<Entry>[] {
    const byDate = new Map<IsoDate, Entry[]>();
    for (const entry of this.entries) {
      const day = byDate.get(entry.entryDate);
      if (day) day.push(entry);
      else byDate.set(entry.entryDate, [entry]);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([date, entries]) => ({
        date,
        totals: EntryBook.total(entries),
        entries: entries.toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      }));
  }

  static total(entries: readonly BookEntry[]): Totals {
    let incomeCents = 0;
    let expenseCents = 0;
    for (const entry of entries) {
      if (entry.type === "income") incomeCents += entry.amountCents;
      else expenseCents += entry.amountCents;
    }
    return {
      incomeCents,
      expenseCents,
      profitCents: incomeCents - expenseCents,
      count: entries.length,
    };
  }
}
