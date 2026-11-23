import { describe, expect, it } from "vitest";
import { CategoryCatalog, defaultCategoryRows, type CategoryRow } from "@/lib/categories/category";
import { MonthlySummary as RealMonthlySummary, type SummaryEntry } from "./monthly-summary";

/** A guest's list (the defaults): Transport, Family use, Owner salary and Wastage are hidden costs. */
const catalog = new CategoryCatalog(defaultCategoryRows(), (key) => key);
const INCOME_CATEGORIES = catalog.options("income").map((category) => category.ref);
const EXPENSE_CATEGORIES = catalog.options("expense").map((category) => category.ref);
const HIDDEN_COST_CATEGORIES = catalog.options("expense").filter((c) => c.countsAs === "hidden_cost").map((c) => c.ref);

/** The summary with the default catalog, so the cases below read the same as before. */
class MonthlySummary extends RealMonthlySummary {
  constructor(month: string, entries: readonly SummaryEntry[], previous: readonly SummaryEntry[] = []) {
    super(catalog, month, entries, previous);
  }
}

function entry(
  type: "income" | "expense",
  category: string,
  amountCents: number,
  entryDate: string,
): SummaryEntry {
  return { type, category, amountCents, entryDate };
}

// Part D2 wireframe: Income 650,000 · Expenses 540,000 · Profit 110,000 (17%) · Real profit 72,000.
const november: SummaryEntry[] = [
  entry("income", "sales", 40_000_000, "2026-11-03"),
  entry("income", "sales", 25_000_000, "2026-11-20"),
  entry("expense", "stock", 37_800_000, "2026-11-04"),
  entry("expense", "rent", 5_400_000, "2026-11-05"),
  entry("expense", "salary", 6_000_000, "2026-11-30"),
  entry("expense", "electricity", 1_800_000, "2026-11-30"),
  entry("expense", "other", 3_000_000, "2026-11-12"),
  entry("expense", "family_use", 2_000_000, "2026-11-12"),
  entry("expense", "owner_salary", 1_000_000, "2026-11-12"),
  entry("expense", "wastage", 500_000, "2026-11-13"),
  entry("expense", "transport", 300_000, "2026-11-14"),
];

describe("MonthlySummary totals", () => {
  const summary = new MonthlySummary("2026-11", november);

  it("works out income, expenses, profit and profit %", () => {
    expect(summary.totals.incomeCents).toBe(65_000_000);
    expect(summary.totals.expenseCents).toBe(54_000_000);
    expect(summary.totals.profitCents).toBe(11_000_000);
    expect(Math.round(summary.profitPercent ?? 0)).toBe(17);
  });

  it("shows cash profit and then real profit, with each hidden cost taken off once", () => {
    expect(summary.totals.hiddenCostCents).toBe(3_800_000);
    expect(summary.totals.realProfitCents).toBe(7_200_000);
    // In the owner's list order (the defaults put Transport first), zeros included.
    expect(summary.hiddenCosts()).toEqual([
      { category: "transport", amountCents: 300_000 },
      { category: "family_use", amountCents: 2_000_000 },
      { category: "owner_salary", amountCents: 1_000_000 },
      { category: "wastage", amountCents: 500_000 },
    ]);
  });

  it("has no profit % without income", () => {
    expect(new MonthlySummary("2026-11", [entry("expense", "rent", 100, "2026-11-01")]).profitPercent).toBeNull();
  });

  it("ignores entries from other months", () => {
    const mixed = new MonthlySummary("2026-11", [
      ...november,
      entry("income", "sales", 99_999_900, "2026-10-31"),
      entry("income", "sales", 99_999_900, "2026-12-01"),
    ]);
    expect(mixed.totals).toEqual(summary.totals);
  });

  it("is empty without entries", () => {
    const empty = new MonthlySummary("2026-11", []);
    expect(empty.isEmpty).toBe(true);
    expect(empty.topCosts()).toEqual([]);
    expect(empty.comparison()).toBeNull();
    expect(empty.dailyTotals()).toHaveLength(30);
    expect(summary.isEmpty).toBe(false);
  });
});

describe("MonthlySummary daily profit (bar chart)", () => {
  const days = new MonthlySummary("2026-11", november).dailyTotals();

  it("lists every day of the month in order, empty days included", () => {
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe("2026-11-01");
    expect(days[29].date).toBe("2026-11-30");
    expect(days[0]).toMatchObject({ incomeCents: 0, expenseCents: 0, profitCents: 0, count: 0 });
  });

  it("shows a day with only costs as a loss", () => {
    const fourth = days.find((day) => day.date === "2026-11-04");
    expect(fourth).toMatchObject({ profitCents: -37_800_000, count: 1 });
  });

  it("keeps hidden costs out of the daily profit", () => {
    // 12 Nov: other 30,000 is a shop cost; family use and owner salary are hidden costs.
    expect(days.find((day) => day.date === "2026-11-12")?.profitCents).toBe(-3_000_000);
    expect(days.find((day) => day.date === "2026-11-14")?.profitCents).toBe(0);
  });

  it("adds up to the month: the chart never disagrees with the cards", () => {
    const sum = (pick: (day: (typeof days)[number]) => number) =>
      days.reduce((total, day) => total + pick(day), 0);
    expect(sum((day) => day.incomeCents)).toBe(65_000_000);
    expect(sum((day) => day.expenseCents)).toBe(54_000_000);
    expect(sum((day) => day.profitCents)).toBe(11_000_000);
  });

  it("knows a short month and a leap February", () => {
    expect(new MonthlySummary("2026-02", []).dailyTotals()).toHaveLength(28);
    expect(new MonthlySummary("2028-02", []).dailyTotals()).toHaveLength(29);
  });
});

describe("MonthlySummary top costs", () => {
  const summary = new MonthlySummary("2026-11", november);

  it("lists the three biggest shop costs with their share of all expenses", () => {
    const top = summary.topCosts();
    expect(top.map((cost) => cost.category)).toEqual(["stock", "salary", "rent"]);
    expect(top[0].percent).toBeCloseTo(70, 5); // 378,000 of 540,000
    expect(top[2].percent).toBeCloseTo(10, 5);
  });

  it("does not list hidden costs", () => {
    const only = new MonthlySummary("2026-11", [
      entry("expense", "rent", 100_000, "2026-11-01"),
      entry("expense", "family_use", 900_000, "2026-11-01"),
    ]);
    expect(only.topCosts()).toEqual([{ category: "rent", amountCents: 100_000, percent: 100 }]);
  });

  it("can list fewer or more", () => {
    expect(summary.topCosts(1)).toHaveLength(1);
    expect(summary.topCosts(10)).toHaveLength(5);
  });
});

describe("MonthlySummary vs last month", () => {
  const october: SummaryEntry[] = [
    entry("income", "sales", 50_000_000, "2026-10-10"),
    entry("expense", "stock", 40_000_000, "2026-10-11"),
  ];

  it("shows the change in profit and in percent: 100,000 → 110,000 is +10,000 (+10%)", () => {
    const comparison = new MonthlySummary("2026-11", november, october).comparison();
    expect(comparison).toEqual({
      month: "2026-10",
      profitChangeCents: 1_000_000,
      profitChangePercent: 10,
    });
  });

  it("shows a drop as a negative change", () => {
    const worse = new MonthlySummary("2026-11", [entry("income", "sales", 5_000_000, "2026-11-01")], october);
    expect(worse.comparison()?.profitChangeCents).toBe(-5_000_000);
    expect(worse.comparison()?.profitChangePercent).toBe(-50);
  });

  it("has no percent when last month's profit was zero", () => {
    const zero = [entry("income", "sales", 100, "2026-10-01"), entry("expense", "stock", 100, "2026-10-02")];
    expect(new MonthlySummary("2026-11", november, zero).comparison()?.profitChangePercent).toBeNull();
  });

  it("is left out when last month has no entries, and crosses the new year", () => {
    expect(new MonthlySummary("2026-11", november).comparison()).toBeNull();
    expect(new MonthlySummary("2026-11", november, [entry("income", "sales", 1, "2026-09-01")]).comparison()).toBeNull();
    const january = new MonthlySummary("2027-01", [], [entry("income", "sales", 1, "2026-12-31")]);
    expect(january.comparison()?.month).toBe("2026-12");
  });
});

describe("Totals match the manual sum (Part G1, Day 10)", () => {
  /** A small repeatable random generator, so a failure can be reproduced. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return state / 4_294_967_296;
    };
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("random month %i: every number equals a plain loop over the entries", (seed) => {
    const next = random(seed);
    const entries: SummaryEntry[] = Array.from({ length: 400 }, () => {
      const isIncome = next() < 0.4;
      const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      return entry(
        isIncome ? "income" : "expense",
        categories[Math.floor(next() * categories.length)],
        1 + Math.floor(next() * 5_000_000),
        `2026-11-${String(1 + Math.floor(next() * 30)).padStart(2, "0")}`,
      );
    });

    // The manual sum: add every entry by hand.
    let income = 0;
    let shopCosts = 0;
    let hidden = 0;
    for (const e of entries) {
      if (e.type === "income") income += e.amountCents;
      else if (HIDDEN_COST_CATEGORIES.includes(e.category)) hidden += e.amountCents;
      else shopCosts += e.amountCents;
    }

    const summary = new MonthlySummary("2026-11", entries);
    expect(summary.totals.incomeCents).toBe(income);
    expect(summary.totals.expenseCents).toBe(shopCosts);
    expect(summary.totals.profitCents).toBe(income - shopCosts);
    expect(summary.totals.hiddenCostCents).toBe(hidden);
    expect(summary.totals.realProfitCents).toBe(income - shopCosts - hidden);

    const days = summary.dailyTotals();
    expect(days.reduce((sum, day) => sum + day.profitCents, 0)).toBe(income - shopCosts);
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(entries.length);
    expect(summary.hiddenCosts().reduce((sum, cost) => sum + cost.amountCents, 0)).toBe(hidden);
  });
});

describe("toSnapshot", () => {
  it("is plain data that survives JSON (it travels from the server to the browser)", () => {
    const snapshot = new MonthlySummary("2026-11", november).toSnapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.days).toHaveLength(30);
    expect(snapshot.topCosts).toHaveLength(3);
  });
});

describe("MonthlySummary with a shop's own categories (Part D9)", () => {
  const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const row = (partial: Partial<CategoryRow> & Pick<CategoryRow, "type">): CategoryRow => ({
    id: null, key: null, name: null, icon: "tag", color: "gray", countsAs: "normal", sort: 100, archived: false, ...partial,
  });
  const shopRows: CategoryRow[] = [
    row({ id: ID(1), type: "income", key: "sales", sort: 1 }),
    row({ id: ID(2), type: "expense", key: "stock", sort: 1 }),
    row({ id: ID(3), type: "expense", name: "Packaging", sort: 2, countsAs: "hidden_cost" }),
    row({ id: ID(4), type: "expense", key: "family_use", sort: 3, countsAs: "hidden_cost" }),
    row({ id: ID(5), type: "expense", name: "Old habit", sort: 4, countsAs: "hidden_cost", archived: true }),
    row({ id: ID(6), type: "expense", key: "transport", sort: 5 }), // the owner turned the hidden cost off
  ];
  const shop = new CategoryCatalog(shopRows, (key) => key);
  const month = [
    entry("income", ID(1), 10_000_000, "2026-11-02"),
    entry("expense", ID(2), 4_000_000, "2026-11-03"),
    entry("expense", ID(3), 500_000, "2026-11-04"),
    entry("expense", ID(6), 300_000, "2026-11-05"),
    entry("expense", ID(5), 200_000, "2026-11-06"),
  ];
  const summary = new RealMonthlySummary(shop, "2026-11", month);

  it("counts the owner's own hidden-cost category, and Transport as an ordinary cost once the owner turned it off", () => {
    expect(summary.totals).toMatchObject({ expenseCents: 4_300_000, hiddenCostCents: 700_000, profitCents: 5_700_000, realProfitCents: 5_000_000 });
  });

  it("lists every offered hidden cost (zeros too), then a hidden one that was put away but still has money", () => {
    expect(summary.hiddenCosts()).toEqual([
      { category: ID(3), amountCents: 500_000 },
      { category: ID(4), amountCents: 0 },
      { category: ID(5), amountCents: 200_000 },
    ]);
  });

  it("groups the same category together whether the entry names its id or its default key", () => {
    const mixed = new RealMonthlySummary(shop, "2026-11", [
      entry("expense", ID(2), 1_000_000, "2026-11-03"),
      entry("expense", "stock", 2_000_000, "2026-11-04"),
    ]);
    expect(mixed.topCosts()).toEqual([{ category: ID(2), amountCents: 3_000_000, percent: 100 }]);
  });

  it("lists the owner's own category among the biggest costs", () => {
    expect(summary.topCosts().map((cost) => cost.category)).toEqual([ID(2), ID(6)]);
  });
});
