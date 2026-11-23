import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase } from "./helpers/test-database";

/**
 * The undo (migrations 0007 and 0012): "put back a change" restores EVERYTHING that
 * changed, including the category id, product and quantity; a product that was
 * removed since is dropped instead of making the undo fail; and a used-up history
 * row cannot be used twice.
 */

let db: TestDatabase;
const ids = { owner: "", shop: "", cake: "", tea: "", sales: "", otherIncome: "" };

interface EntryRow {
  category: string | null;
  category_id: string | null;
  product_id: string | null;
  quantity: string | null;
  amount_cents: string;
  note: string | null;
}

const entryRow = (id: string) =>
  db
    .asService<EntryRow>("select category, category_id, product_id, quantity::text, amount_cents::text, note from entries where id = $1", [id])
    .then((result) => result.rows[0]);

const historyIds = (entry: string) =>
  db
    .asService<{ id: string }>("select id::text from entry_history where entry_id = $1 order by id", [entry])
    .then((result) => result.rows.map((row) => row.id));

/** An entry for 3 cakes in the "sales" category, made by server code like the app does. */
async function addSale(): Promise<string> {
  const { rows } = await db.asService<{ id: string }>(
    `insert into entries (business_id, type, category, amount_cents, entry_date, note, created_by, product_id, quantity)
     values ($1, 'income', 'sales', 195000, current_date, 'three cakes', $2, $3, 3) returning id`,
    [ids.shop, ids.owner, ids.cake],
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await TestDatabase.create();
  ids.owner = await db.createUser("Owner");
  ids.shop = await db.as(ids.owner, async (s) =>
    (await s.query<{ id: string }>("insert into businesses (owner_id, name) values ($1, 'Main Shop') returning id", [ids.owner])).rows[0].id,
  );
  const product = (name: string) =>
    db
      .asService<{ id: string }>("insert into products (business_id, name, cost_cents, price_cents) values ($1, $2, 40000, 65000) returning id", [ids.shop, name])
      .then((result) => result.rows[0].id);
  ids.cake = await product("Chocolate cake");
  ids.tea = await product("Tea");
  const category = (key: string) =>
    db
      .asService<{ id: string }>("select id from categories where business_id = $1 and key = $2", [ids.shop, key])
      .then((result) => result.rows[0].id);
  ids.sales = await category("sales");
  ids.otherIncome = await category("other_income");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Undo puts back the product, quantity and category too", () => {
  it("restores every field after a change: category, product, quantity, amount and note", async () => {
    const entry = await addSale();
    const before = await entryRow(entry);
    expect(before).toMatchObject({ category: "sales", category_id: ids.sales, product_id: ids.cake, quantity: "3.000", amount_cents: "195000" });

    // The owner edits the record: another category, another product, other quantity and amount.
    await db.as(ids.owner, (s) =>
      s.query("update entries set category_id = $2, category = null, product_id = $3, quantity = 1, amount_cents = 100, note = 'edited' where id = $1", [entry, ids.otherIncome, ids.tea]),
    );
    expect(await entryRow(entry)).toMatchObject({ category_id: ids.otherIncome, product_id: ids.tea, quantity: "1.000", amount_cents: "100" });

    const [change] = await historyIds(entry);
    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [change]));
    expect(await entryRow(entry)).toEqual(before);
  });

  it("brings back a deleted entry with its product, quantity and category", async () => {
    const entry = await addSale();
    const before = await entryRow(entry);
    await db.as(ids.owner, (s) => s.query("delete from entries where id = $1", [entry]));
    expect(await entryRow(entry)).toBeUndefined();

    const [deleted] = await historyIds(entry);
    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [deleted]));
    expect(await entryRow(entry)).toEqual(before);
  });

  it("keeps the amount but drops the product when that product has been removed since", async () => {
    const gone = await db
      .asService<{ id: string }>("insert into products (business_id, name, cost_cents, price_cents) values ($1, 'Short-lived', 100, 200) returning id", [ids.shop])
      .then((result) => result.rows[0].id);
    const entry = await db
      .asService<{ id: string }>(
        `insert into entries (business_id, type, category, amount_cents, entry_date, created_by, product_id, quantity)
         values ($1, 'income', 'sales', 600, current_date, $2, $3, 3) returning id`,
        [ids.shop, ids.owner, gone],
      )
      .then((result) => result.rows[0].id);
    await db.as(ids.owner, (s) => s.query("delete from entries where id = $1", [entry]));
    const [deleted] = await historyIds(entry);
    await db.asService("delete from products where id = $1", [gone]);

    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [deleted]));
    expect(await entryRow(entry)).toMatchObject({ product_id: null, quantity: null, amount_cents: "600" });
  });
});

describe("A restored change is used up", () => {
  it("removes the history row it used, so it cannot be restored twice", async () => {
    const entry = await addSale();
    await db.as(ids.owner, (s) => s.query("delete from entries where id = $1", [entry]));
    const [deleted] = await historyIds(entry);

    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [deleted]));
    expect(await historyIds(entry)).not.toContain(deleted);
    await expect(db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [deleted]))).rejects.toThrow(/not_allowed/);
  });

  it("an undo of a change can itself be undone (the values from just before it are kept)", async () => {
    const entry = await addSale();
    await db.as(ids.owner, (s) => s.query("update entries set amount_cents = 5000 where id = $1", [entry]));
    const [first] = await historyIds(entry);

    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [first]));
    expect((await entryRow(entry)).amount_cents).toBe("195000");

    // The undo was itself a change: its "before" (5000) is a new history row.
    const [again] = await historyIds(entry);
    expect(again).not.toBe(first);
    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [again]));
    expect((await entryRow(entry)).amount_cents).toBe("5000");
  });

  it("an entry that was deleted after a change cannot be 'un-changed' (it must be brought back first)", async () => {
    const entry = await addSale();
    await db.as(ids.owner, (s) => s.query("update entries set amount_cents = 5000 where id = $1", [entry]));
    const [change] = await historyIds(entry);
    await db.as(ids.owner, (s) => s.query("delete from entries where id = $1", [entry]));
    await expect(db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [change]))).rejects.toThrow(/entry_not_found/);
    // ...and the failed attempt did not use the row up.
    expect(await historyIds(entry)).toContain(change);
  });
});

describe("Migration 0012 housekeeping", () => {
  it("removes the old 'features' setting (feature_flags replaces it) and keeps the others", async () => {
    const { rows } = await db.asService<{ key: string }>("select key from app_settings order by key");
    const keys = rows.map((row) => row.key);
    expect(keys).not.toContain("features");
    expect(keys).toEqual(expect.arrayContaining(["maintenance", "pro_limits", "defaults", "support"]));
  });

  it("does not fail where the cron extension is missing (the tests' plain Postgres)", async () => {
    const { rows } = await db.asService<{ n: number }>("select count(*)::int as n from pg_extension where extname = 'pg_cron'");
    expect(rows[0].n).toBe(0);
  });
});
