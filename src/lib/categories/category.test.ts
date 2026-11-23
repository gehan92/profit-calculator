import { describe, expect, it } from "vitest";
import {
  CategoryCatalog,
  defaultCategoryRows,
  hasCategoryRefShape,
  isCategoryId,
  type CategoryRow,
} from "./category";

const NAMES: Record<string, string> = {
  sales: "Sales", other_income: "Other income", stock: "Stock", rent: "Rent", transport: "Transport",
  family_use: "Family use", other: "Other", fuel: "Fuel", water: "Water",
};
const labelOfKey = (key: string) => NAMES[key] ?? key;

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function row(partial: Partial<CategoryRow> & Pick<CategoryRow, "type">): CategoryRow {
  return { id: null, key: null, name: null, icon: "tag", color: "gray", countsAs: "normal", sort: 100, archived: false, ...partial };
}

/** A shop with default categories, one renamed, one hidden and two of its own. */
const shopRows: CategoryRow[] = [
  row({ id: ID(1), type: "income", key: "sales", sort: 1 }),
  row({ id: ID(2), type: "income", key: "other_income", sort: 9 }),
  row({ id: ID(3), type: "income", name: "Tuition", sort: 5 }),
  row({ id: ID(4), type: "expense", key: "stock", sort: 1 }),
  row({ id: ID(5), type: "expense", key: "rent", name: "Shop rent", sort: 3 }),
  row({ id: ID(6), type: "expense", key: "water", sort: 6, archived: true }),
  row({ id: ID(7), type: "expense", key: "transport", sort: 9, countsAs: "hidden_cost" }),
  row({ id: ID(8), type: "expense", name: "Packaging", sort: 2, countsAs: "hidden_cost" }),
  row({ id: ID(9), type: "expense", key: "other", sort: 99 }),
];
const shop = new CategoryCatalog(shopRows, labelOfKey);

describe("category references", () => {
  it("tells an id from a key", () => {
    expect(isCategoryId(ID(1))).toBe(true);
    expect(isCategoryId("stock")).toBe(false);
    expect(hasCategoryRefShape(ID(1))).toBe(true);
    expect(hasCategoryRefShape("stock")).toBe(true);
    for (const bad of ["", "Stock", "has space", "1abc", "a".repeat(41), "drop;table"]) expect(hasCategoryRefShape(bad)).toBe(false);
  });
});

describe("CategoryCatalog options", () => {
  it("offers a kind's visible categories in the owner's order, with the owner's own names", () => {
    expect(shop.options("expense").map((c) => c.label)).toEqual(["Stock", "Packaging", "Shop rent", "Transport", "Other"]);
    expect(shop.options("income").map((c) => c.label)).toEqual(["Sales", "Tuition", "Other income"]);
  });

  it("leaves a hidden category out of the picker but keeps it in Settings", () => {
    expect(shop.options("expense").some((c) => c.key === "water")).toBe(false);
    expect(shop.all("expense").some((c) => c.key === "water")).toBe(true);
  });

  it("uses the id as the reference, and the key when there is no id (guests)", () => {
    expect(shop.options("income")[0].ref).toBe(ID(1));
    const guest = new CategoryCatalog(defaultCategoryRows(), labelOfKey);
    expect(guest.options("income")[0].ref).toBe("sales");
  });

  it("chooses the first offered category by default", () => {
    expect(shop.defaultRef("income")).toBe(ID(1));
    expect(shop.defaultRef("expense")).toBe(ID(4));
  });
});

describe("CategoryCatalog lookups", () => {
  it("finds a category by id or by default key, only within the right kind", () => {
    expect(shop.find(ID(5), "expense")?.label).toBe("Shop rent");
    expect(shop.find("rent", "expense")?.label).toBe("Shop rent");
    expect(shop.find(ID(5), "income")).toBeUndefined();
    expect(shop.find("sales", "expense")).toBeUndefined();
    expect(shop.find(null, "expense")).toBeUndefined();
  });

  it("still names a hidden category on an old entry", () => {
    expect(shop.label(ID(6), "expense")).toBe("Water");
  });

  it("never fails: a default key the shop lacks keeps its default name, anything else reads 'Other'", () => {
    expect(shop.resolve("fuel", "expense").label).toBe("Fuel");
    expect(shop.resolve("fuel", "expense").countsAs).toBe("normal");
    expect(shop.resolve(ID(99), "expense").label).toBe("Other");
    expect(shop.resolve(ID(99), "income").label).toBe("Other income");
    expect(shop.resolve("made_up", "expense").label).toBe("Other");
  });
});

describe("CategoryCatalog hidden costs", () => {
  it("treats the shop's own choice as the rule, even for the owner's own category", () => {
    expect(shop.isHiddenCost(ID(7), "expense")).toBe(true);
    expect(shop.isHiddenCost(ID(8), "expense")).toBe(true);
    expect(shop.isHiddenCost(ID(4), "expense")).toBe(false);
  });

  it("follows a changed choice: if the owner turns Transport off, it is an ordinary cost", () => {
    const changed = new CategoryCatalog(shopRows.map((r) => (r.id === ID(7) ? { ...r, countsAs: "normal" as const } : r)), labelOfKey);
    expect(changed.isHiddenCost(ID(7), "expense")).toBe(false);
    expect(changed.isHiddenCost("transport", "expense")).toBe(false);
  });

  it("knows the default hidden costs by key for a guest", () => {
    const guest = new CategoryCatalog(defaultCategoryRows(), labelOfKey);
    for (const key of ["family_use", "owner_salary", "wastage", "transport"]) expect(guest.isHiddenCost(key, "expense")).toBe(true);
    for (const key of ["stock", "rent", "other"]) expect(guest.isHiddenCost(key, "expense")).toBe(false);
  });

  it("never treats money in as a hidden cost", () => {
    expect(shop.isHiddenCost(ID(1), "income")).toBe(false);
  });
});

describe("defaultCategoryRows (the guest list)", () => {
  it("is what a new shop starts with: no ids, no hidden ones, both kinds and products", () => {
    const rows = defaultCategoryRows();
    expect(rows.every((r) => r.id === null && !r.archived && r.name === null)).toBe(true);
    expect(rows.filter((r) => r.type === "income").map((r) => r.key)).toEqual(["sales", "other_income"]);
    expect(rows.some((r) => r.key === "fuel")).toBe(false);
  });
});
