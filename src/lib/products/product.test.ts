import { describe, expect, it } from "vitest";
import {
  groupByCompany,
  lineAmountCents,
  marginHealth,
  productFieldsSchema,
  productMargin,
  suggestCompanies,
  unitAmountCents,
} from "./product";

const base = {
  name: "Chocolate cake",
  kind: "own" as const,
  companyName: null,
  unit: "piece" as const,
  costCents: 40_000,
  priceCents: 65_000,
  barcode: null,
  notes: null,
};

describe("productFieldsSchema", () => {
  it("accepts a product made by the shop and trims what was typed", () => {
    const parsed = productFieldsSchema.safeParse({ ...base, name: "  Chocolate cake  ", notes: "  fresh daily " });
    expect(parsed.success && parsed.data).toMatchObject({ name: "Chocolate cake", notes: "fresh daily", companyName: null });
  });

  it("needs a name of 1–80 letters", () => {
    expect(productFieldsSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
    expect(productFieldsSchema.safeParse({ ...base, name: "x".repeat(81) }).success).toBe(false);
    expect(productFieldsSchema.safeParse({ ...base, name: "x".repeat(80) }).success).toBe(true);
  });

  it("needs a company name for a product from a company, and ignores one on a product made by the shop", () => {
    expect(productFieldsSchema.safeParse({ ...base, kind: "company", companyName: "  " }).success).toBe(false);
    const company = productFieldsSchema.safeParse({ ...base, kind: "company", companyName: " Munchee " });
    expect(company.success && company.data.companyName).toBe("Munchee");
    const own = productFieldsSchema.safeParse({ ...base, kind: "own", companyName: "Munchee" });
    expect(own.success && own.data.companyName).toBeNull();
  });

  it("accepts a free item (cost 0) but never a negative or fractional-cent amount", () => {
    expect(productFieldsSchema.safeParse({ ...base, costCents: 0 }).success).toBe(true);
    expect(productFieldsSchema.safeParse({ ...base, costCents: -1 }).success).toBe(false);
    expect(productFieldsSchema.safeParse({ ...base, priceCents: 10.5 }).success).toBe(false);
  });

  it("only allows the units the database has", () => {
    for (const unit of ["piece", "kg", "litre", "dozen", "service"]) expect(productFieldsSchema.safeParse({ ...base, unit }).success).toBe(true);
    expect(productFieldsSchema.safeParse({ ...base, unit: "stone" }).success).toBe(false);
  });

  it("turns empty optional fields into null", () => {
    const parsed = productFieldsSchema.safeParse({ ...base, barcode: "  ", notes: "" });
    expect(parsed.success && [parsed.data.barcode, parsed.data.notes]).toEqual([null, null]);
  });
});

describe("margin and amounts", () => {
  it("shows profit per unit, margin and markup with the same formulas as the margin calculator", () => {
    expect(productMargin(base)).toMatchObject({ perItemCents: 25_000 });
    expect(productMargin(base).marginPct).toBeCloseTo(38.46, 2);
    expect(productMargin(base).markupPct).toBeCloseTo(62.5, 2);
  });

  it("calls a product a loss, thin or good", () => {
    expect(marginHealth({ costCents: 100, priceCents: 80 })).toBe("loss");
    expect(marginHealth({ costCents: 95, priceCents: 100 })).toBe("thin");
    expect(marginHealth({ costCents: 50, priceCents: 100 })).toBe("good");
    expect(marginHealth({ costCents: 50, priceCents: 0 })).toBe("unknown");
  });

  it("fills a sale from the selling price and a purchase from the cost", () => {
    expect(unitAmountCents(base, "income")).toBe(65_000);
    expect(unitAmountCents(base, "expense")).toBe(40_000);
  });

  it("multiplies by a quantity with decimals and rounds to whole cents", () => {
    expect(lineAmountCents(65_000, 3)).toBe(195_000);
    expect(lineAmountCents(12_000, 1.5)).toBe(18_000);
    expect(lineAmountCents(333, 0.5)).toBe(167);
  });
});

describe("company helpers", () => {
  it("groups products by company, A–Z, with the ones without a company last", () => {
    const groups = groupByCompany([
      { companyName: "Munchee", id: 1 },
      { companyName: "Anchor", id: 2 },
      { companyName: null, id: 3 },
      { companyName: "Munchee", id: 4 },
    ]);
    expect([...groups.keys()]).toEqual(["Anchor", "Munchee", ""]);
    expect(groups.get("Munchee")).toHaveLength(2);
  });

  it("suggests names that contain what was typed, best matches first, never the exact name again", () => {
    const names = ["Munchee", "Maliban", "Anchor", "Ceylon Munch", "Elephant House"];
    expect(suggestCompanies(names, "mun")).toEqual(["Munchee", "Ceylon Munch"]);
    expect(suggestCompanies(names, "munchee")).toEqual([]);
    expect(suggestCompanies(names, "  ")).toEqual([]);
    expect(suggestCompanies(names, "ma", 1)).toEqual(["Maliban"]);
  });
});
