import { describe, expect, it } from "vitest";
import { entryFiltersToQuery, matchesFilters, monthRange, parseEntryFilters } from "./entry-filters";

const NOW = "2026-11";

describe("parseEntryFilters", () => {
  it("uses the default month when the address has none", () => {
    expect(parseEntryFilters({}, NOW)).toEqual({ month: NOW, type: null, category: null });
  });

  it("reads a month, a type and a category", () => {
    expect(
      parseEntryFilters({ month: "2026-09", type: "expense", category: "stock" }, NOW),
    ).toEqual({ month: "2026-09", type: "expense", category: "stock" });
  });

  it("ignores values that are not valid", () => {
    expect(
      parseEntryFilters({ month: "2026-13", type: "loan", category: "lottery" }, NOW),
    ).toEqual({ month: NOW, type: null, category: null });
  });

  it("drops a category that does not fit the type", () => {
    expect(parseEntryFilters({ type: "income", category: "stock" }, NOW).category).toBeNull();
    expect(parseEntryFilters({ type: "expense", category: "stock" }, NOW).category).toBe("stock");
  });

  it("keeps a category without a type", () => {
    expect(parseEntryFilters({ category: "rent" }, NOW)).toEqual({
      month: NOW,
      type: null,
      category: "rent",
    });
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseEntryFilters({ month: ["2026-05", "2026-06"] }, NOW).month).toBe("2026-05");
  });
});

describe("entryFiltersToQuery", () => {
  it("leaves out the default month and empty filters", () => {
    expect(entryFiltersToQuery({ month: NOW, type: null, category: null }, NOW)).toBe("");
  });

  it("writes the filters that are set", () => {
    expect(
      entryFiltersToQuery({ month: "2026-09", type: "expense", category: "stock" }, NOW),
    ).toBe("?month=2026-09&type=expense&category=stock");
  });

  it("round-trips through parseEntryFilters", () => {
    const filters = { month: "2025-12", type: "income", category: "sales" } as const;
    const query = new URLSearchParams(entryFiltersToQuery(filters, NOW));
    expect(parseEntryFilters(Object.fromEntries(query), NOW)).toEqual(filters);
  });
});

describe("monthRange", () => {
  it("runs from the first day to the first day of the next month", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", before: "2026-12-01" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", before: "2027-01-01" });
  });
});

describe("matchesFilters", () => {
  const entry = { type: "expense", category: "stock", entryDate: "2026-11-15" } as const;

  it("matches the month", () => {
    expect(matchesFilters(entry, { month: "2026-11", type: null, category: null })).toBe(true);
    expect(matchesFilters(entry, { month: "2026-10", type: null, category: null })).toBe(false);
  });

  it("matches the type and category when set", () => {
    expect(matchesFilters(entry, { month: "2026-11", type: "income", category: null })).toBe(false);
    expect(matchesFilters(entry, { month: "2026-11", type: "expense", category: "rent" })).toBe(false);
    expect(matchesFilters(entry, { month: "2026-11", type: "expense", category: "stock" })).toBe(true);
  });
});
