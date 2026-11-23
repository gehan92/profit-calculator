import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Entries and categories (migration 0009): an entry may name its category by
 * the old key or by category_id; the database fills in the other one, copies a
 * missing default category into the shop, refuses anything unknown or of the
 * wrong kind, and keeps categories from changing identity. Also: bringing an
 * archived product back counts against the Free limit.
 */

let db: TestDatabase;
const ids = { owner: "", staff: "", other: "", shop: "", staffShop: "", otherShop: "" };

const today = "2026-11-23";

async function categoryRow(shop: string, type: string, key: string) {
  const { rows } = await db.asService<{ id: string; key: string | null; name: string | null }>(
    "select id, key, name from categories where business_id = $1 and type = $2 and key = $3",
    [shop, type, key],
  );
  return rows[0];
}

const storedEntry = async (id: string) =>
  (await db.asService<{ category: string | null; category_id: string | null }>("select category, category_id from entries where id = $1", [id])).rows[0];

const addEntry = (userId: string, shop: string, type: "income" | "expense", category: string | null, categoryId: string | null = null) =>
  db.as(userId, async (s) => {
    const { rows } = await s.query<{ id: string }>(
      `insert into entries (business_id, type, category, category_id, amount_cents, entry_date)
       values ($1, $2, $3, $4, 1000, $5) returning id`,
      [shop, type, category, categoryId, today],
    );
    return rows[0].id;
  });

async function count(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await s.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return rows[0].n;
}

beforeAll(async () => {
  db = await TestDatabase.create();
  ids.owner = await db.createUser("Owner");
  ids.staff = await db.createUser("Staff");
  ids.other = await db.createUser("Other Owner");

  const shop = (owner: string, name: string) =>
    db.as(owner, async (s) => (await s.query<{ id: string }>("insert into businesses (owner_id, name) values ($1, $2) returning id", [owner, name])).rows[0].id);
  ids.shop = await shop(ids.owner, "Main Shop");
  ids.otherShop = await shop(ids.other, "Other Shop");
  await db.asService("insert into business_members (business_id, user_id, role) values ($1, $2, 'staff')", [ids.shop, ids.staff]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("an entry written with the old key only", () => {
  it("gets the shop's category_id for that key", async () => {
    const sales = await categoryRow(ids.shop, "income", "sales");
    const id = await addEntry(ids.owner, ids.shop, "income", "sales");
    expect(await storedEntry(id)).toEqual({ category: "sales", category_id: sales.id });
  });

  it("copies a default category the shop does not have yet (Fuel in a plain shop) and uses it", async () => {
    expect(await categoryRow(ids.shop, "expense", "fuel")).toBeUndefined();
    const id = await addEntry(ids.owner, ids.shop, "expense", "fuel");

    const fuel = await categoryRow(ids.shop, "expense", "fuel");
    expect(fuel).toBeDefined();
    expect(await storedEntry(id)).toEqual({ category: "fuel", category_id: fuel.id });
  });

  it("copies it only once, however many entries use it", async () => {
    await addEntry(ids.owner, ids.shop, "expense", "ingredients");
    await addEntry(ids.owner, ids.shop, "expense", "ingredients");
    const { rows } = await db.asService<{ n: number }>("select count(*)::int as n from categories where business_id = $1 and key = 'ingredients'", [ids.shop]);
    expect(rows[0].n).toBe(1);
  });

  it("works for Staff too (the offline queue and guest records send keys)", async () => {
    const id = await addEntry(ids.staff, ids.shop, "expense", "rent");
    const rent = await categoryRow(ids.shop, "expense", "rent");
    expect(await storedEntry(id)).toEqual({ category: "rent", category_id: rent.id });
  });

  it("refuses a key that no default list has", async () => {
    await expect(addEntry(ids.owner, ids.shop, "expense", "made_up_key")).rejects.toThrow(/unknown_category/);
  });

  it("refuses a key of the wrong kind: Sales is money in, not an expense", async () => {
    await expect(addEntry(ids.owner, ids.shop, "expense", "sales")).rejects.toThrow(/unknown_category/);
    await expect(addEntry(ids.owner, ids.shop, "income", "stock")).rejects.toThrow(/unknown_category/);
  });

  it("refuses an entry with no category at all", async () => {
    await expect(addEntry(ids.owner, ids.shop, "income", null)).rejects.toThrow(/category_required/);
  });
});

describe("an entry written with a category_id", () => {
  it("fills in the key of a default category", async () => {
    const stock = await categoryRow(ids.shop, "expense", "stock");
    const id = await addEntry(ids.owner, ids.shop, "expense", null, stock.id);
    expect(await storedEntry(id)).toEqual({ category: "stock", category_id: stock.id });
  });

  it("leaves the key empty for the owner's own category", async () => {
    const own = await db.as(ids.owner, async (s) =>
      (await s.query<{ id: string }>("insert into categories (business_id, type, name) values ($1, 'expense', 'Packaging') returning id", [ids.shop])).rows[0].id,
    );
    const id = await addEntry(ids.owner, ids.shop, "expense", null, own);
    expect(await storedEntry(id)).toEqual({ category: null, category_id: own });
  });

  it("replaces a wrong key sent along with the id", async () => {
    const stock = await categoryRow(ids.shop, "expense", "stock");
    const id = await addEntry(ids.owner, ids.shop, "expense", "rent", stock.id);
    expect((await storedEntry(id)).category).toBe("stock");
  });

  it("refuses another shop's category and a category of the wrong kind", async () => {
    const otherSales = await categoryRow(ids.otherShop, "income", "sales");
    await expect(addEntry(ids.owner, ids.shop, "income", null, otherSales.id)).rejects.toThrow(/category_not_in_shop/);
    const stock = await categoryRow(ids.shop, "expense", "stock");
    await expect(addEntry(ids.owner, ids.shop, "income", null, stock.id)).rejects.toThrow(/category_not_in_shop/);
  });

  it("a hidden category still works for old entries (hiding only removes it from the picker)", async () => {
    const water = await categoryRow(ids.shop, "expense", "water");
    await db.as(ids.owner, (s) => s.query("update categories set archived = true where id = $1", [water.id]));
    const id = await addEntry(ids.owner, ids.shop, "expense", null, water.id);
    expect((await storedEntry(id)).category_id).toBe(water.id);
  });
});

describe("changing an entry's category", () => {
  it("moving it to another category_id updates the key", async () => {
    const rent = await categoryRow(ids.shop, "expense", "rent");
    const salary = await categoryRow(ids.shop, "expense", "salary");
    const id = await addEntry(ids.owner, ids.shop, "expense", null, rent.id);
    await db.as(ids.owner, (s) => s.query("update entries set category_id = $2 where id = $1", [id, salary.id]));
    expect(await storedEntry(id)).toEqual({ category: "salary", category_id: salary.id });
  });

  it("changing only the old key moves the entry to that category (older app versions)", async () => {
    const rent = await categoryRow(ids.shop, "expense", "rent");
    const salary = await categoryRow(ids.shop, "expense", "salary");
    const id = await addEntry(ids.owner, ids.shop, "expense", null, rent.id);
    await db.as(ids.owner, (s) => s.query("update entries set category = 'salary' where id = $1", [id]));
    expect(await storedEntry(id)).toEqual({ category: "salary", category_id: salary.id });
  });

  it("sending the same category_id with an empty key (some clients do) keeps the category", async () => {
    const rent = await categoryRow(ids.shop, "expense", "rent");
    const id = await addEntry(ids.owner, ids.shop, "expense", null, rent.id);
    await db.as(ids.owner, (s) => s.query("update entries set category = null, category_id = $2, amount_cents = 7000 where id = $1", [id, rent.id]));
    expect(await storedEntry(id)).toEqual({ category: "rent", category_id: rent.id });
  });

  it("changing the amount leaves the category alone", async () => {
    const rent = await categoryRow(ids.shop, "expense", "rent");
    const id = await addEntry(ids.owner, ids.shop, "expense", null, rent.id);
    await db.as(ids.owner, (s) => s.query("update entries set amount_cents = 5000 where id = $1", [id]));
    expect(await storedEntry(id)).toEqual({ category: "rent", category_id: rent.id });
  });

  it("switching the type to one the category does not fit is refused", async () => {
    const rent = await categoryRow(ids.shop, "expense", "rent");
    const id = await addEntry(ids.owner, ids.shop, "expense", null, rent.id);
    await expect(db.as(ids.owner, (s) => s.query("update entries set type = 'income' where id = $1", [id]))).rejects.toThrow(/category_not_in_shop/);
  });
});

describe("categories keep their identity", () => {
  it("the owner can rename, hide, reorder and mark a hidden cost", async () => {
    const result = await db.as(ids.owner, (s) =>
      s.query("update categories set name = 'Shop rent', sort = 5, archived = true where business_id = $1 and key = 'rent'", [ids.shop]),
    );
    expect(result.affectedRows).toBe(1);
    await db.as(ids.owner, (s) => s.query("update categories set counts_as = 'hidden_cost' where business_id = $1 and key = 'repairs'", [ids.shop]));
    expect(
      await db.as(ids.owner, (s) => count(s, "select 1 from categories where business_id = $1 and key = 'repairs' and counts_as = 'hidden_cost'", [ids.shop])),
    ).toBe(1);
  });

  it("the type, the shop and the key can never change", async () => {
    await expect(db.as(ids.owner, (s) => s.query("update categories set type = 'income' where business_id = $1 and key = 'stock'", [ids.shop]))).rejects.toThrow(/category_identity_locked/);
    await expect(db.as(ids.owner, (s) => s.query("update categories set key = 'bought_goods' where business_id = $1 and key = 'stock'", [ids.shop]))).rejects.toThrow(/category_identity_locked/);
    await expect(db.as(ids.owner, (s) => s.query("update categories set business_id = $2 where business_id = $1 and key = 'stock'", [ids.shop, ids.otherShop]))).rejects.toThrow();
  });

  it("two own categories cannot share a name (any letter case) in one kind", async () => {
    await db.as(ids.owner, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'income', 'Tuition')", [ids.shop]));
    await expect(db.as(ids.owner, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'income', 'TUITION')", [ids.shop]))).rejects.toThrow();
    // …but the same name in the other kind is fine.
    await db.as(ids.owner, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'expense', 'Tuition')", [ids.shop]));
  });

  it("Staff cannot add or change categories", async () => {
    await expect(db.as(ids.staff, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'expense', 'Sneaky')", [ids.shop]))).rejects.toThrow();
    expect((await db.as(ids.staff, (s) => s.query("update categories set name = 'X' where business_id = $1", [ids.shop]))).affectedRows).toBe(0);
  });

  it("a category with entries cannot be deleted (hide it instead)", async () => {
    const stock = await categoryRow(ids.shop, "expense", "stock");
    await addEntry(ids.owner, ids.shop, "expense", null, stock.id);
    await expect(db.as(ids.owner, (s) => s.query("delete from categories where id = $1", [stock.id]))).rejects.toThrow();
  });
});

describe("products: the Free limit and names", () => {
  const addProduct = (name: string) =>
    db.as(ids.owner, async (s) =>
      (await s.query<{ id: string }>("insert into products (business_id, name, cost_cents, price_cents) values ($1, $2, 100, 150) returning id", [ids.shop, name])).rows[0].id,
    );

  it("bringing an archived product back counts against the limit of 20 active products", async () => {
    const first = await addProduct("Bread");
    await db.as(ids.owner, (s) => s.query("update products set archived = true where id = $1", [first]));
    for (let i = 0; i < 20; i++) await addProduct(`Item ${i}`);

    await expect(db.as(ids.owner, (s) => s.query("update products set archived = false where id = $1", [first]))).rejects.toThrow(/free_limit_products/);
    // Hiding one frees a place.
    const any = (await db.asService<{ id: string }>("select id from products where business_id = $1 and not archived limit 1", [ids.shop])).rows[0].id;
    await db.as(ids.owner, (s) => s.query("update products set archived = true where id = $1", [any]));
    await db.as(ids.owner, (s) => s.query("update products set archived = false where id = $1", [first]));
  });

  it("two active products cannot share a name, but an archived one does not block it", async () => {
    await db.asService("delete from products where business_id = $1", [ids.shop]);
    const bread = await addProduct("Bread");
    await expect(addProduct("bread")).rejects.toThrow();
    await db.as(ids.owner, (s) => s.query("update products set archived = true where id = $1", [bread]));
    await addProduct("BREAD");
  });
});
