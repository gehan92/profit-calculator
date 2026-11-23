import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES } from "@/lib/business/business-types";
import { CATEGORY_TEMPLATES, isDefaultKey, templatesFor } from "./categories";

/** The default categories as migration 0007 inserts them. */
function templatesFromMigration() {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0007_products_categories.sql"), "utf8");
  const block = sql.slice(sql.indexOf("insert into categories (business_id, type, key, icon, color, counts_as, business_types, sort)"));
  const row = /\(null,\s*'(\w+)',\s*'(\w+)',\s*'([\w-]+)',\s*'(\w+)',\s*'(\w+)',\s*(null|'\{[\w,]+\}'),\s*(\d+)\)/g;
  return [...block.matchAll(row)].map(([, type, key, icon, color, countsAs, types, sort]) => ({
    key,
    type,
    icon,
    color,
    countsAs,
    sort: Number(sort),
    businessTypes: types === "null" ? null : types.slice(2, -2).split(","),
  }));
}

describe("default categories", () => {
  it("match migration 0007 exactly (the TypeScript list is a mirror of the database defaults)", () => {
    const fromSql = templatesFromMigration();
    expect(fromSql).toHaveLength(18);
    expect(CATEGORY_TEMPLATES.map((t) => ({ ...t, businessTypes: t.businessTypes ? [...t.businessTypes] : null }))).toEqual(fromSql);
  });

  it("only expense categories can be hidden costs, and exactly four are", () => {
    const hidden = CATEGORY_TEMPLATES.filter((t) => t.countsAs === "hidden_cost");
    expect(hidden.map((t) => t.key).toSorted()).toEqual(["family_use", "owner_salary", "transport", "wastage"]);
    expect(hidden.every((t) => t.type === "expense")).toBe(true);
  });

  it("only use business types the database knows", () => {
    for (const template of CATEGORY_TEMPLATES) {
      for (const type of template.businessTypes ?? []) expect(BUSINESS_TYPES).toContain(type);
    }
  });

  it("give a shop (and a guest) the same list as the database gives a new shop", () => {
    expect(templatesFor(null, "income").map((t) => t.key)).toEqual(["sales", "other_income"]);
    expect(templatesFor("shop", "expense").map((t) => t.key)).toEqual([
      "stock", "rent", "salary", "electricity", "water", "phone_internet", "repairs", "transport", "family_use", "owner_salary", "wastage", "other",
    ]);
  });

  it("give a driver Fuel and Service income instead of Stock", () => {
    expect(templatesFor("transport", "expense").map((t) => t.key)).toContain("fuel");
    expect(templatesFor("transport", "expense").map((t) => t.key)).not.toContain("stock");
    expect(templatesFor("transport", "income").map((t) => t.key)).toContain("service_income");
  });

  it("recognise a default key only for its own kind of entry", () => {
    expect(isDefaultKey("income", "sales")).toBe(true);
    expect(isDefaultKey("expense", "sales")).toBe(false);
    expect(isDefaultKey("expense", "made_up")).toBe(false);
  });
});
