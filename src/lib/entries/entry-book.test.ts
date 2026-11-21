import { describe, expect, it } from "vitest";
import type { Category } from "@/config/categories";
import { EntryBook, type BookEntry } from "./entry-book";

function entry(
  type: "income" | "expense",
  amountCents: number,
  entryDate: string,
  createdAt = `${entryDate}T10:00:00.000Z`,
  category: Category = type === "income" ? "sales" : "stock",
): BookEntry {
  return { type, category, amountCents, entryDate, createdAt };
}

// The profit calculator example (Part D1) spread over real entries.
const book = new EntryBook([
  entry("income", 2_500_000, "2026-11-15", "2026-11-15T09:00:00.000Z"),
  entry("expense", 1_500_000, "2026-11-15", "2026-11-15T11:00:00.000Z"),
  entry("expense", 150_000, "2026-11-15", "2026-11-15T10:00:00.000Z", "other"),
  entry("income", 1_000_000, "2026-11-14"),
  entry("expense", 300_000, "2026-10-31"),
]);

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
    expect(new EntryBook([]).days()).toEqual([]);
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
    const totals = EntryBook.total(month);
    expect(totals.expenseCents).toBe(54_000_000);
    expect(totals.profitCents).toBe(11_000_000); // Cash profit 110,000
    expect(totals.hiddenCostCents).toBe(3_800_000);
    expect(totals.realProfitCents).toBe(7_200_000); // Real profit 72,000
  });

  it("loses nothing: expenses + hidden costs are every expense entry", () => {
    const totals = EntryBook.total(month);
    const everyExpense = month
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    expect(totals.expenseCents + totals.hiddenCostCents).toBe(everyExpense);
  });

  it("never counts an income entry as a hidden cost", () => {
    expect(EntryBook.total([entry("income", 100, "2026-11-01", undefined, "other_income")]))
      .toMatchObject({ incomeCents: 100, hiddenCostCents: 0 });
  });
});
