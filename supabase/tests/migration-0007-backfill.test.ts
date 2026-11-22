import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase } from "./helpers/test-database";

/**
 * Upgrading a database that already has shops and entries (migration 0007):
 * every shop gets its categories, every entry that used a default key now
 * points to the matching category, and the upgrade writes no history rows.
 */

let db: TestDatabase;
const ids = { owner: "", shopA: "", shopB: "" };

beforeAll(async () => {
  db = await TestDatabase.create({ stopBefore: "0007" });
  ids.owner = await db.createUser("Old Owner");

  const shop = async (name: string, locale: string) =>
    (await db.asService<{ id: string }>("insert into businesses (owner_id, name, locale) values ($1, $2, $3) returning id", [ids.owner, name, locale])).rows[0].id;
  ids.shopA = await shop("Shop A", "en");
  ids.shopB = await shop("Shop B", "si");

  for (const [type, category] of [
    ["income", "sales"], ["expense", "stock"], ["expense", "family_use"], ["expense", "rent"], ["income", "other_income"],
  ] as const) {
    for (const shopId of [ids.shopA, ids.shopB]) {
      await db.asService(
        "insert into entries (business_id, type, category, amount_cents, entry_date, created_by) values ($1, $2, $3, 1000, current_date, $4)",
        [shopId, type, category, ids.owner],
      );
    }
  }
  // An entry edited before the upgrade has history; the upgrade must not add to it.
  await db.asService("update entries set note = 'edited' where business_id = $1 and category = 'rent'", [ids.shopA]);
  await db.migrate("0007");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Upgrading existing shops and entries", () => {
  it("gives every existing shop its categories", async () => {
    for (const shop of [ids.shopA, ids.shopB]) {
      const { rows } = await db.asService<{ n: number }>("select count(*)::int as n from categories where business_id = $1", [shop]);
      expect(rows[0].n).toBe(15);
    }
  });

  it("points every existing entry at the category with the same key, in its own shop", async () => {
    const { rows } = await db.asService<{ business_id: string; category: string; key: string; counts_as: string }>(
      `select e.business_id, e.category, c.key, c.counts_as
         from entries e join categories c on c.id = e.category_id
        where c.business_id = e.business_id and c.type = e.type::text and c.key = e.category`,
    );
    expect(rows).toHaveLength(10);
    expect(rows.filter((row) => row.category === "family_use").every((row) => row.counts_as === "hidden_cost")).toBe(true);
    const { rows: unlinked } = await db.asService<{ n: number }>("select count(*)::int as n from entries where category_id is null");
    expect(unlinked[0].n).toBe(0);
  });

  it("keeps the old key text, so nothing that read it breaks", async () => {
    const { rows } = await db.asService<{ category: string }>("select distinct category from entries order by category");
    expect(rows.map((row) => row.category)).toEqual(["family_use", "other_income", "rent", "sales", "stock"]);
  });

  it("writes no history rows for the upgrade itself", async () => {
    const { rows } = await db.asService<{ n: number }>("select count(*)::int as n from entry_history");
    // Only the one real edit made before the upgrade.
    expect(rows[0].n).toBe(1);
  });

  it("history triggers are switched back on afterwards", async () => {
    await db.asService("update entries set note = 'after upgrade' where business_id = $1 and category = 'sales'", [ids.shopA]);
    const { rows } = await db.asService<{ n: number }>("select count(*)::int as n from entry_history");
    expect(rows[0].n).toBe(2);
  });

  it("the products feature is switched on and own categories are always on", async () => {
    const { rows } = await db.asService<{ key: string; status: string }>("select key, status from feature_flags where key in ('products', 'custom_categories') order by key");
    expect(rows).toEqual([
      { key: "custom_categories", status: "on" },
      { key: "products", status: "on" },
    ]);
  });
});
