import { monthOf, type IsoDate } from "@/lib/dates";
import type { EntryFields, EntryType } from "./entry";

/**
 * Decides which expenses are hidden costs. The shop's `CategoryCatalog` is
 * the rule (the owner chooses in Settings → Categories); tests can pass a
 * simpler one.
 */
export interface HiddenCostRule {
  isHiddenCost(category: string, type: EntryType): boolean;
}

/**
 * Money in and out for some entries.
 *
 * - `expenseCents` are the shop's own costs (stock, rent, salary…).
 * - `hiddenCostCents` are the costs owners forget (family use, owner salary,
 *   wastage, transport by default): the categories marked "hidden cost".
 * - Profit = Income − Expenses (Part D1): the "cash profit".
 * - Real profit = Profit − hidden costs (Part D2 "Real profit"), so a hidden
 *   cost is subtracted once, never twice.
 *
 * Together, expenses + hidden costs are every expense entry: nothing is lost.
 */
export interface Totals {
  incomeCents: number;
  expenseCents: number;
  hiddenCostCents: number;
  profitCents: number;
  realProfitCents: number;
  count: number;
}

/** The fields that decide a total. */
export type TotalEntry = Pick<EntryFields, "type" | "category" | "amountCents">;

/** The fields a book needs from an entry; works for local and database entries alike. */
export type BookEntry = TotalEntry &
  Pick<EntryFields, "entryDate"> & {
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
 * Used by guest mode and by the Owner screens.
 */
export class EntryBook<Entry extends BookEntry> {
  constructor(
    private readonly entries: readonly Entry[],
    private readonly rule: HiddenCostRule,
  ) {}

  get size(): number {
    return this.entries.length;
  }

  /** Totals for one day, e.g. today. */
  forDay(date: IsoDate): Totals {
    return EntryBook.total(this.entries.filter((entry) => entry.entryDate === date), this.rule);
  }

  /** Totals for one month, e.g. "2026-11". */
  forMonth(month: string): Totals {
    return EntryBook.total(this.entries.filter((entry) => monthOf(entry.entryDate) === month), this.rule);
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
        totals: EntryBook.total(entries, this.rule),
        entries: entries.toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      }));
  }

  /** Adds up entries. The rule says which expenses are hidden costs. */
  static total(entries: readonly TotalEntry[], rule: HiddenCostRule): Totals {
    let incomeCents = 0;
    let expenseCents = 0;
    let hiddenCostCents = 0;
    for (const entry of entries) {
      if (entry.type === "income") incomeCents += entry.amountCents;
      else if (rule.isHiddenCost(entry.category, entry.type)) hiddenCostCents += entry.amountCents;
      else expenseCents += entry.amountCents;
    }
    const profitCents = incomeCents - expenseCents;
    return {
      incomeCents,
      expenseCents,
      hiddenCostCents,
      profitCents,
      realProfitCents: profitCents - hiddenCostCents,
      count: entries.length,
    };
  }
}
