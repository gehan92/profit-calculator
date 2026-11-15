import { describe, expect, it } from "vitest";
import {
  clientEntrySchema,
  entryFieldsSchema,
  ENTRY_NOTE_MAX_LENGTH,
  isCategoryOf,
  MAX_AMOUNT_CENTS,
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
    ["unknown category", { category: "lottery" }],
    ["income category on an expense", { category: "sales" }],
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

describe("isCategoryOf", () => {
  it("matches categories to their type", () => {
    expect(isCategoryOf("income", "sales")).toBe(true);
    expect(isCategoryOf("income", "stock")).toBe(false);
    expect(isCategoryOf("expense", "owner_salary")).toBe(true);
  });
});
