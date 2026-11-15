import { describe, expect, it } from "vitest";
import { EntryBook, type BookEntry } from "./entry-book";

function entry(
  type: "income" | "expense",
  amountCents: number,
  entryDate: string,
  createdAt = `${entryDate}T10:00:00.000Z`,
): BookEntry {
  return { type, amountCents, entryDate, createdAt };
}

// The profit calculator example (Part D1) spread over real entries.
const book = new EntryBook([
  entry("income", 2_500_000, "2026-11-15", "2026-11-15T09:00:00.000Z"),
  entry("expense", 1_500_000, "2026-11-15", "2026-11-15T11:00:00.000Z"),
  entry("expense", 150_000, "2026-11-15", "2026-11-15T10:00:00.000Z"),
  entry("income", 1_000_000, "2026-11-14"),
  entry("expense", 300_000, "2026-10-31"),
]);

describe("EntryBook", () => {
  it("adds up one day: 25,000 − (15,000 + 1,500) = 8,500", () => {
    expect(book.forDay("2026-11-15")).toEqual({
      incomeCents: 2_500_000,
      expenseCents: 1_650_000,
      profitCents: 850_000,
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
      profitCents: 0,
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
