import { describe, expect, it } from "vitest";
import type { StoredEntry } from "./entry";
import { buildEntriesCsv, type EntryCsvLabels } from "./entry-csv";

const labels: EntryCsvLabels = {
  columns: {
    date: "Date",
    type: "Type",
    category: "Category",
    product: "Product",
    quantity: "Quantity",
    amount: "Amount",
    currency: "Currency",
    note: "Note",
    addedAt: "Added at (UTC)",
  },
  date: (isoDate) => isoDate,
  type: (type) => (type === "income" ? "Income" : "Expense"),
  category: (entry) => (entry.category === "sales" ? "Sales" : entry.category === "stock" ? "Stock" : entry.category),
  product: (entry) => (entry.productId === "p1" ? "Cream biscuits" : ""),
};

const entry = (overrides: Partial<StoredEntry>): StoredEntry => ({
  id: "1",
  type: "income",
  category: "sales",
  amountCents: 2_500_000,
  entryDate: "2026-11-15",
  note: null,
  productId: null,
  quantity: null,
  createdAt: "2026-11-15T09:00:00.000Z",
  clientId: null,
  ...overrides,
});

describe("buildEntriesCsv", () => {
  it("writes a heading row and one row per entry with plain decimal amounts", () => {
    const lines = buildEntriesCsv(
      [
        entry({}),
        entry({
          id: "2",
          type: "expense",
          category: "stock",
          amountCents: 150_050,
          note: "rice, 5 kg",
          entryDate: "2026-11-16",
        }),
      ],
      "LKR",
      labels,
    )
      .replace("﻿", "")
      .split("\r\n");

    expect(lines[0]).toBe("Date,Type,Category,Product,Quantity,Amount,Currency,Note,Added at (UTC)");
    expect(lines[1]).toBe("2026-11-15,Income,Sales,,,25000.00,LKR,,2026-11-15T09:00:00.000Z");
    expect(lines[2]).toBe('2026-11-16,Expense,Stock,,,1500.50,LKR,"rice, 5 kg",2026-11-15T09:00:00.000Z');
    expect(lines[3]).toBe("");
  });

  it("writes the product name and the quantity (a plain number) when an entry has them", () => {
    const lines = buildEntriesCsv([entry({ productId: "p1", quantity: 2.5 })], "LKR", labels).replace("﻿", "").split("\r\n");
    expect(lines[1]).toBe("2026-11-15,Income,Sales,Cream biscuits,2.5,25000.00,LKR,,2026-11-15T09:00:00.000Z");
  });

  it("writes the Date column the way the person chose (Account → Language & region)", () => {
    const dayFirst: EntryCsvLabels = {
      ...labels,
      date: (isoDate) => isoDate.split("-").reverse().join("/"),
    };
    const lines = buildEntriesCsv([entry({})], "LKR", dayFirst).replace("﻿", "").split("\r\n");
    expect(lines[1]).toBe("15/11/2026,Income,Sales,,,25000.00,LKR,,2026-11-15T09:00:00.000Z");
  });

  it("only has the heading row when there are no entries", () => {
    const lines = buildEntriesCsv([], "LKR", labels).replace("﻿", "").trimEnd().split("\r\n");
    expect(lines).toHaveLength(1);
  });

  it("does not let a note run as a spreadsheet formula", () => {
    const csv = buildEntriesCsv([entry({ note: '=HYPERLINK("http://x")' })], "LKR", labels);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("uses the shop's currency code", () => {
    expect(buildEntriesCsv([entry({})], "USD", labels)).toContain(",25000.00,USD,");
  });
});
