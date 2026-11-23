import { describe, expect, it } from "vitest";
import type { StoredEntry } from "@/lib/entries/entry";
import type { Product } from "@/lib/products/product";
import { buildMyDataExport, myDataFilename, type MyDataInput, type ShopData } from "./my-data";
import type { AccountProfile } from "./profile-repository";

const profile: AccountProfile = {
  fullName: "Kamala Perera",
  avatarUrl: null,
  locale: "si",
  dateFormat: "dmy",
  defaultCurrency: "LKR",
  notifications: { daily: true, dailyTime: "20:00", weekly: false, payments: true },
  supportAccessUntil: null,
};

const cake: Product = {
  id: "p1",
  name: "Chocolate cake",
  kind: "own",
  companyName: null,
  unit: "piece",
  costCents: 40_000,
  priceCents: 65_000,
  barcode: null,
  notes: null,
  archived: false,
};

const entry = (overrides: Partial<StoredEntry>): StoredEntry => ({
  id: "e1",
  type: "income",
  category: "sales",
  amountCents: 195_000,
  entryDate: "2026-11-23",
  note: null,
  productId: null,
  quantity: null,
  createdAt: "2026-11-23T10:00:00Z",
  clientId: null,
  ...overrides,
});

const shop: ShopData = {
  name: "Kamala Stores",
  currency: "LKR",
  businessType: "shop",
  categories: [
    { id: "c1", key: "sales", name: null, type: "income", icon: "shopping-cart", color: "green", countsAs: "normal", sort: 1, archived: false },
  ],
  products: [cake],
  entries: [entry({ productId: "p1", quantity: 3 }), entry({ id: "e2", type: "expense", category: "rent", amountCents: 1_200_000, note: "Nov rent" })],
  categoryLabel: (e) => (e.category === "sales" ? "Sales" : "Rent"),
  entriesTruncated: false,
};

const input: MyDataInput = {
  exportedAt: new Date("2026-11-23T12:00:00Z"),
  account: { email: "kamala@example.com" },
  profile,
  shops: [shop],
  subscription: null,
  payments: [
    { id: "pay1", paidAt: "2026-10-01T09:00:00Z", amountCents: 99_000, currency: "LKR", status: "paid", invoiceUrl: "https://example.com/i/1" },
  ],
  supportAccessLog: ["2026-11-20T08:00:00Z"],
};

describe("buildMyDataExport", () => {
  const data = buildMyDataExport(input) as {
    exportedAt: string;
    account: { email: string };
    profile: Record<string, unknown>;
    shops: { name: string; entries: Record<string, unknown>[]; entriesComplete: boolean; categories: Record<string, unknown>[] }[];
    payments: Record<string, unknown>[];
    plan: unknown;
    supportAccessLog: string[];
  };

  it("says when it was made and whose it is", () => {
    expect(data.exportedAt).toBe("2026-11-23T12:00:00.000Z");
    expect(data.account.email).toBe("kamala@example.com");
  });

  it("holds the profile and its settings", () => {
    expect(data.profile).toMatchObject({ name: "Kamala Perera", language: "si", dateFormat: "dmy", defaultCurrency: "LKR" });
  });

  it("writes each entry with readable names and the amount twice (cents and decimal)", () => {
    expect(data.shops[0].entries[0]).toEqual({
      date: "2026-11-23",
      type: "income",
      category: "Sales",
      product: "Chocolate cake",
      quantity: 3,
      amountCents: 195_000,
      amount: "1950.00",
      note: null,
      addedAt: "2026-11-23T10:00:00Z",
    });
    expect(data.shops[0].entries[1]).toMatchObject({ category: "Rent", product: null, amount: "12000.00", note: "Nov rent" });
  });

  it("does not export internal ids of entries, shops or categories", () => {
    const text = JSON.stringify(data);
    expect(text).not.toContain('"id"');
    expect(text).not.toContain('"clientId"');
    expect(text).not.toContain('"businessId"');
  });

  it("says whether the shop's records are all there", () => {
    expect(data.shops[0].entriesComplete).toBe(true);
    const cut = buildMyDataExport({ ...input, shops: [{ ...shop, entriesTruncated: true }] }) as typeof data;
    expect(cut.shops[0].entriesComplete).toBe(false);
  });

  it("includes billing and the access log", () => {
    expect(data.payments[0]).toEqual({ date: "2026-10-01T09:00:00Z", amountCents: 99_000, amount: "990.00", currency: "LKR", status: "paid" });
    expect(data.supportAccessLog).toEqual(["2026-11-20T08:00:00Z"]);
    expect(data.plan).toBeNull();
  });

  it("never includes an invoice link or any secret", () => {
    expect(JSON.stringify(data)).not.toContain("example.com/i/1");
  });

  it("handles a person with no shop (staff or viewer): profile and billing only", () => {
    const staff = buildMyDataExport({ ...input, shops: [] }) as typeof data;
    expect(staff.shops).toEqual([]);
    expect(staff.profile).toBeDefined();
  });
});

describe("myDataFilename", () => {
  it("includes the date", () => {
    expect(myDataFilename("2026-11-23")).toBe("profit-calculator-my-data-2026-11-23.json");
  });
});
