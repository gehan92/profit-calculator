import { describe, expect, it } from "vitest";
import {
  clientEntrySchema,
  entryFieldsSchema,
  ENTRY_NOTE_MAX_LENGTH,
  MAX_AMOUNT_CENTS,
  MAX_QUANTITY,
} from "./entry";

const valid = {
  type: "expense",
  category: "family_use",
  amountCents: 150_050,
  entryDate: "2026-11-15",
  note: "  Rice for home  ",
};

describe("entryFieldsSchema (Part D2 Add entry rules)", () => {
  it("accepts a normal entry and tidies the note", () => {
    const result = entryFieldsSchema.parse(valid);
    expect(result.note).toBe("Rice for home");
  });

  it("turns an empty note into null", () => {
    expect(entryFieldsSchema.parse({ ...valid, note: "   " }).note).toBeNull();
    expect(entryFieldsSchema.parse({ ...valid, note: null }).note).toBeNull();
  });

  it.each([
    ["zero amount", { amountCents: 0 }],
    ["negative amount", { amountCents: -100 }],
    ["part of a cent", { amountCents: 10.5 }],
    ["too big", { amountCents: MAX_AMOUNT_CENTS + 1 }],
    ["unknown default key", { category: "lottery" }],
    ["income category on an expense", { category: "sales" }],
    ["a category that is not a key or an id", { category: "Family Use!" }],
    ["no category", { category: "" }],
    ["impossible date", { entryDate: "2026-02-30" }],
    ["very old date", { entryDate: "1999-12-31" }],
    ["note too long", { note: "a".repeat(ENTRY_NOTE_MAX_LENGTH + 1) }],
    ["unknown type", { type: "loan" }],
  ])("refuses %s", (_name, change) => {
    expect(entryFieldsSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe("clientEntrySchema", () => {
  const local = {
    ...valid,
    clientId: "7f1c1d3e-1111-4c4c-9a9a-000000000001",
    createdAt: "2026-11-15T08:30:00.000Z",
  };

  it("accepts an entry made in the browser", () => {
    expect(clientEntrySchema.safeParse(local).success).toBe(true);
  });

  it("needs a real clientId and time", () => {
    expect(clientEntrySchema.safeParse({ ...local, clientId: "abc" }).success).toBe(false);
    expect(clientEntrySchema.safeParse({ ...local, createdAt: "yesterday" }).success).toBe(false);
  });
});

const CATEGORY_ID = "0b6a5c2e-4d1f-4a8e-9a77-2f7d3c9e1a10";
const PRODUCT_ID = "5d0d1c2e-6b3f-4f1c-8a21-7a9e3b1c4d55";

describe("category references (a default key, or the shop's category id)", () => {
  it("accepts a category id of the shop, for either kind of entry", () => {
    expect(entryFieldsSchema.safeParse({ ...valid, category: CATEGORY_ID }).success).toBe(true);
    expect(entryFieldsSchema.safeParse({ ...valid, type: "income", category: CATEGORY_ID }).success).toBe(true);
  });

  it("checks a default key against its own kind of entry (the database checks an id)", () => {
    expect(entryFieldsSchema.safeParse({ ...valid, type: "income", category: "sales" }).success).toBe(true);
    expect(entryFieldsSchema.safeParse({ ...valid, type: "income", category: "stock" }).success).toBe(false);
    expect(entryFieldsSchema.safeParse({ ...valid, category: "fuel" }).success).toBe(true);
  });
});

describe("product and quantity (Part D8)", () => {
  it("an older entry without them gets none", () => {
    const result = entryFieldsSchema.parse(valid);
    expect(result).toMatchObject({ productId: null, quantity: null });
  });

  it("accepts a product with a quantity, whole or with up to 3 decimals", () => {
    for (const quantity of [1, 3, 1.5, 0.25, 2.125, MAX_QUANTITY]) {
      expect(entryFieldsSchema.safeParse({ ...valid, productId: PRODUCT_ID, quantity }).success).toBe(true);
    }
  });

  it("refuses a product without a quantity, or a quantity without a product", () => {
    expect(entryFieldsSchema.safeParse({ ...valid, productId: PRODUCT_ID, quantity: null }).success).toBe(false);
    expect(entryFieldsSchema.safeParse({ ...valid, productId: null, quantity: 2 }).success).toBe(false);
  });

  it("refuses 0, negative, too many decimals, too big and a product id that is not an id", () => {
    for (const quantity of [0, -1, 1.2345, MAX_QUANTITY + 1]) {
      expect(entryFieldsSchema.safeParse({ ...valid, productId: PRODUCT_ID, quantity }).success).toBe(false);
    }
    expect(entryFieldsSchema.safeParse({ ...valid, productId: "bread", quantity: 1 }).success).toBe(false);
  });

  it("an entry saved on the phone before products existed still reads (no product, no quantity)", () => {
    const old = { ...valid, clientId: "7f1c1d3e-1111-4c4c-9a9a-000000000002", createdAt: "2026-11-15T08:30:00.000Z" };
    expect(clientEntrySchema.parse(old)).toMatchObject({ productId: null, quantity: null });
  });
});
