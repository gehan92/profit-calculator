import type { CategoryCatalog } from "@/lib/categories/category";
import { addDays, daysInMonth, firstDayOfMonth, monthOf, shiftMonth, type IsoDate } from "@/lib/dates";
import { EntryBook, type Totals, type TotalEntry } from "./entry-book";

/** An entry as the summary needs it. */
export type SummaryEntry = TotalEntry & { entryDate: IsoDate };

/** One day of the month. Profit here is the cash profit, as everywhere else. */
export interface DaySummary {
  date: IsoDate;
  incomeCents: number;
  expenseCents: number;
  profitCents: number;
  /** Entries on this day, so empty days can be left out of the "Entries by day" list. */
  count: number;
}

/** One of the biggest costs: its amount and its share of all expenses. */
export interface CostShare {
  /** The category's reference (id, or key for guests); the catalog gives its name. */
  category: string;
  amountCents: number;
  /** 0–100. */
  percent: number;
}

export interface HiddenCost {
  category: string;
  amountCents: number;
}

/** This month's profit against last month's ("vs Oct: +12,000 (+12%)"). */
export interface MonthComparison {
  month: string;
  /** This month's profit minus last month's. */
  profitChangeCents: number;
  /** The change as a percent of last month's profit; `null` when last month's profit was 0. */
  profitChangePercent: number | null;
}

/** The summary as plain data, ready to send from the server to the browser. */
export interface SummarySnapshot {
  month: string;
  totals: Totals;
  /** Profit ÷ income × 100; `null` when there is no income. */
  profitPercent: number | null;
  /** Every day of the month in order, empty days included (the chart needs them). */
  days: DaySummary[];
  topCosts: CostShare[];
  /** Every hidden-cost category in the owner's order, zeros included. */
  hiddenCosts: HiddenCost[];
  comparison: MonthComparison | null;
}

/** How many of the biggest costs the card lists (Part D2: "top 3 costs"). */
export const TOP_COSTS_LIMIT = 3;

/**
 * The monthly summary (Part D2 "Monthly summary"): income, expenses, profit
 * and profit %, daily profit for the bar chart, the top 3 costs, the real
 * profit with its hidden costs, and the change from last month.
 *
 * It uses `EntryBook.total` for every total, so Home, Entries and Summary
 * can never disagree. Entries from other months are ignored. The shop's
 * categories (`catalog`) say which costs are hidden costs.
 */
export class MonthlySummary {
  readonly totals: Totals;
  private readonly entries: readonly SummaryEntry[];
  private readonly previousMonth: string;
  private readonly previousTotals: Totals;

  /**
   * @param catalog The shop's categories (which costs are hidden costs).
   * @param month "2026-11".
   * @param entries This month's entries (anything from other months is ignored).
   * @param previousEntries Last month's entries, for "vs last month".
   */
  constructor(
    private readonly catalog: CategoryCatalog,
    readonly month: string,
    entries: readonly SummaryEntry[],
    previousEntries: readonly SummaryEntry[] = [],
  ) {
    this.entries = entries.filter((entry) => monthOf(entry.entryDate) === month);
    this.totals = EntryBook.total(this.entries, catalog);
    this.previousMonth = shiftMonth(month, -1);
    this.previousTotals = EntryBook.total(
      previousEntries.filter((entry) => monthOf(entry.entryDate) === this.previousMonth),
      catalog,
    );
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /** Profit as a percent of income (Part D1: Profit % = Profit ÷ Sales × 100). */
  get profitPercent(): number | null {
    return this.totals.incomeCents > 0
      ? (this.totals.profitCents / this.totals.incomeCents) * 100
      : null;
  }

  /** Every day of the month, in order, with its income, expenses and profit. */
  dailyTotals(): DaySummary[] {
    const byDate = new Map<IsoDate, TotalEntry[]>();
    for (const entry of this.entries) {
      const day = byDate.get(entry.entryDate);
      if (day) day.push(entry);
      else byDate.set(entry.entryDate, [entry]);
    }

    const first = firstDayOfMonth(this.month);
    return Array.from({ length: daysInMonth(this.month) }, (_, index) => {
      const date = addDays(first, index);
      const totals = EntryBook.total(byDate.get(date) ?? [], this.catalog);
      return {
        date,
        incomeCents: totals.incomeCents,
        expenseCents: totals.expenseCents,
        profitCents: totals.profitCents,
        count: totals.count,
      };
    });
  }

  /**
   * The biggest costs among the shop's own expenses, as a share of all of
   * them ("Stock 70%, Rent 10%"). Hidden costs are shown in the Real profit
   * card instead, so they are not listed here.
   */
  topCosts(limit: number = TOP_COSTS_LIMIT): CostShare[] {
    const byCategory = new Map<string, number>();
    for (const entry of this.entries) {
      if (entry.type !== "expense" || this.catalog.isHiddenCost(entry.category, "expense")) continue;
      // The same category counts as one, whether the entry names its id or its key.
      const category = this.catalog.resolve(entry.category, "expense").ref;
      byCategory.set(category, (byCategory.get(category) ?? 0) + entry.amountCents);
    }

    return [...byCategory.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([category, amountCents]) => ({
        category,
        amountCents,
        percent: (amountCents / this.totals.expenseCents) * 100,
      }));
  }

  /**
   * The hidden-cost categories with what was recorded this month: every one
   * the owner offers (zeros included), then any hidden one that was put away
   * but still has an amount this month.
   */
  hiddenCosts(): HiddenCost[] {
    const amounts = new Map<string, number>();
    for (const entry of this.entries) {
      if (entry.type !== "expense" || !this.catalog.isHiddenCost(entry.category, "expense")) continue;
      const ref = this.catalog.resolve(entry.category, "expense").ref;
      amounts.set(ref, (amounts.get(ref) ?? 0) + entry.amountCents);
    }

    const offered = this.catalog
      .options("expense")
      .filter((category) => category.countsAs === "hidden_cost")
      .map((category) => category.ref);
    const putAway = [...amounts.keys()].filter((ref) => !offered.includes(ref));
    return [...offered, ...putAway].map((category) => ({ category, amountCents: amounts.get(category) ?? 0 }));
  }

  /** `null` when last month has no entries, so there is nothing to compare with. */
  comparison(): MonthComparison | null {
    if (this.previousTotals.count === 0) return null;

    const profitChangeCents = this.totals.profitCents - this.previousTotals.profitCents;
    const previousProfit = Math.abs(this.previousTotals.profitCents);
    return {
      month: this.previousMonth,
      profitChangeCents,
      profitChangePercent: previousProfit > 0 ? (profitChangeCents / previousProfit) * 100 : null,
    };
  }

  toSnapshot(): SummarySnapshot {
    return {
      month: this.month,
      totals: this.totals,
      profitPercent: this.profitPercent,
      days: this.dailyTotals(),
      topCosts: this.topCosts(),
      hiddenCosts: this.hiddenCosts(),
      comparison: this.comparison(),
    };
  }
}
