import { describe, expect, it } from "vitest";
import { CategoryCatalog, defaultCategoryRows } from "@/lib/categories/category";
import { EntryBook, type BookEntry } from "./entry-book";

/** A guest's rule: the default list, where Transport, Family use, Owner salary and Wastage are hidden costs. */
const rule = new CategoryCatalog(defaultCategoryRows(), (key) => key);

function entry(
  type: "income" | "expense",
  amountCents: number,
  entryDate: string,
  createdAt = `${entryDate}T10:00:00.000Z`,
  category: string = type === "income" ? "sales" : "stock",
): BookEntry {
  return { type, category, amountCents, entryDate, createdAt };
}

// The profit calculator example (Part D1) spread over real entries.
const book = new EntryBook(
  [
    entry("income", 2_500_000, "2026-11-15", "2026-11-15T09:00:00.000Z"),
    entry("expense", 1_500_000, "2026-11-15", "2026-11-15T11:00:00.000Z"),
    entry("expense", 150_000, "2026-11-15", "2026-11-15T10:00:00.000Z", "other"),
    entry("income", 1_000_000, "2026-11-14"),
    entry("expense", 300_000, "2026-10-31"),
  ],
  rule,
);

describe("EntryBook", () => {
  it("adds up one day: 25,000 − (15,000 + 1,500) = 8,500", () => {
    expect(book.forDay("2026-11-15")).toEqual({
      incomeCents: 2_500_000,
      expenseCents: 1_650_000,
      hiddenCostCents: 0,
      profitCents: 850_000,
      realProfitCents: 850_000,
      count: 3,
    });
  });

  it("adds up one month and leaves other months out", () => {
    expect(book.forMonth("2026-11").profitCents).toBe(1_850_000);
    expect(book.forMonth("2026-10").profitCents).toBe(-300_000);
  });

  it("returns zeros for a day without entries", () => {
    expect(book.forDay("2026-11-16")).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      hiddenCostCents: 0,
      profitCents: 0,
      realProfitCents: 0,
      count: 0,
    });
  });

  it("groups by day, newest day first and newest entry first", () => {
    const days = book.days();
    expect(days.map((day) => day.date)).toEqual(["2026-11-15", "2026-11-14", "2026-10-31"]);
    expect(days[0].entries.map((e) => e.createdAt)).toEqual([
      "2026-11-15T11:00:00.000Z",
      "2026-11-15T10:00:00.000Z",
      "2026-11-15T09:00:00.000Z",
    ]);
    expect(days[2].totals.profitCents).toBe(-300_000);
  });

  it("knows its size", () => {
    expect(book.size).toBe(5);
    expect(new EntryBook([], rule).days()).toEqual([]);
  });
});

describe("EntryBook.total with hidden costs (Part D2 Real profit)", () => {
  // Part D2 example: cash profit 110,000 → real profit 72,000.
  const month = [
    entry("income", 65_000_000, "2026-11-10"),
    entry("expense", 54_000_000, "2026-11-11"),
    entry("expense", 2_000_000, "2026-11-12", undefined, "family_use"),
    entry("expense", 1_000_000, "2026-11-12", undefined, "owner_salary"),
    entry("expense", 500_000, "2026-11-13", undefined, "wastage"),
    entry("expense", 300_000, "2026-11-14", undefined, "transport"),
  ];

  it("keeps hidden costs out of expenses and cash profit, and takes them off real profit once", () => {
    const totals = EntryBook.total(month, rule);
    expect(totals.expenseCents).toBe(54_000_000);
    expect(totals.profitCents).toBe(11_000_000); // Cash profit 110,000
    expect(totals.hiddenCostCents).toBe(3_800_000);
    expect(totals.realProfitCents).toBe(7_200_000); // Real profit 72,000
  });

  it("loses nothing: expenses + hidden costs are every expense entry", () => {
    const totals = EntryBook.total(month, rule);
    const everyExpense = month
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    expect(totals.expenseCents + totals.hiddenCostCents).toBe(everyExpense);
  });

  it("never counts an income entry as a hidden cost", () => {
    expect(EntryBook.total([entry("income", 100, "2026-11-01", undefined, "other_income")], rule))
      .toMatchObject({ incomeCents: 100, hiddenCostCents: 0 });
  });
});

describe("EntryBook.total follows the shop's own hidden-cost choice (Part D9)", () => {
  const ID_PACKAGING = "0b6a5c2e-4d1f-4a8e-9a77-2f7d3c9e1a10";
  const ID_TRANSPORT = "0b6a5c2e-4d1f-4a8e-9a77-2f7d3c9e1a11";
  const shopRule = (transportHidden: boolean) =>
    new CategoryCatalog(
      [
        ...defaultCategoryRows().filter((row) => row.key !== "transport" && row.key !== "stock"),
        { id: ID_PACKAGING, key: null, name: "Packaging", type: "expense", icon: "tag", color: "gray", countsAs: "hidden_cost", sort: 50, archived: false },
        { id: ID_TRANSPORT, key: "transport", name: null, type: "expense", icon: "truck", color: "gray", countsAs: transportHidden ? "hidden_cost" : "normal", sort: 9, archived: false },
      ],
      (key) => key,
    );
  const entries = [
    entry("income", 1_000_000, "2026-11-10"),
    entry("expense", 200_000, "2026-11-10", undefined, ID_PACKAGING),
    entry("expense", 100_000, "2026-11-10", undefined, ID_TRANSPORT),
  ];

  it("counts the owner's own hidden-cost category as a hidden cost", () => {
    expect(EntryBook.total(entries, shopRule(false))).toMatchObject({ expenseCents: 100_000, hiddenCostCents: 200_000 });
  });

  it("moves Transport between expenses and hidden costs when the owner changes it", () => {
    expect(EntryBook.total(entries, shopRule(true))).toMatchObject({ expenseCents: 0, hiddenCostCents: 300_000, realProfitCents: 700_000 });
    expect(EntryBook.total(entries, shopRule(false))).toMatchObject({ expenseCents: 100_000, hiddenCostCents: 200_000 });
  });

  it("recognises an entry that names the default key as the same category as the id", () => {
    const byKey = [entry("expense", 100_000, "2026-11-10", undefined, "transport")];
    expect(EntryBook.total(byKey, shopRule(true)).hiddenCostCents).toBe(100_000);
  });
});
