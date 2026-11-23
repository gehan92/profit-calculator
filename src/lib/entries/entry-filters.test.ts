import { describe, expect, it } from "vitest";
import {
  entryFiltersToQuery,
  matchesFilters,
  monthRange,
  parseEntryFilters,
  parseMonthParam,
} from "./entry-filters";

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
      parseEntryFilters({ month: "2026-13", type: "loan", category: "Not a key!" }, NOW),
    ).toEqual({ month: NOW, type: null, category: null });
  });

  it("drops a category that does not fit the type", () => {
    expect(parseEntryFilters({ type: "income", category: "stock" }, NOW).category).toBeNull();
    expect(parseEntryFilters({ type: "expense", category: "stock" }, NOW).category).toBe("stock");
  });

  it("keeps a category id (the shop's own list), also for either type", () => {
    const id = "0b6a5c2e-4d1f-4a8e-9a77-2f7d3c9e1a10";
    expect(parseEntryFilters({ type: "income", category: id }, NOW).category).toBe(id);
    expect(parseEntryFilters({ category: id }, NOW).category).toBe(id);
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

describe("parseMonthParam", () => {
  it("reads a real month, also from a repeated parameter", () => {
    expect(parseMonthParam("2026-10", "2026-11")).toBe("2026-10");
    expect(parseMonthParam(["2026-09", "2026-08"], "2026-11")).toBe("2026-09");
  });

  it.each([undefined, "", "2026-13", "2026-1", "november", "2026-11-05"])(
    "falls back to the default for %j",
    (value) => {
      expect(parseMonthParam(value, "2026-11")).toBe("2026-11");
    },
  );
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

describe("matchesFilters with a category that has an id and a key", () => {
  const id = "0b6a5c2e-4d1f-4a8e-9a77-2f7d3c9e1a10";
  // The shop's "stock" category is known by its id and by its default key.
  const canonical = (category: string) => (category === "stock" ? id : category);

  it("counts an entry saved with the key as the same category as a filter with the id", () => {
    const entry = { type: "expense", category: "stock", entryDate: "2026-11-15" } as const;
    const filters = { month: "2026-11", type: null, category: id };
    expect(matchesFilters(entry, filters)).toBe(false);
    expect(matchesFilters(entry, filters, canonical)).toBe(true);
  });

  it("still tells different categories apart", () => {
    const entry = { type: "expense", category: "rent", entryDate: "2026-11-15" } as const;
    expect(matchesFilters(entry, { month: "2026-11", type: null, category: id }, canonical)).toBe(false);
  });
});
