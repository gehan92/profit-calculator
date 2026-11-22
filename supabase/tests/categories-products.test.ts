import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Categories (Part D9) and products (Part D8), migration 0007: every shop gets
 * its own copy of the default categories, owners add / rename / hide their own,
 * other shops never see them, entries and products can only point to their own
 * shop's categories and products, and the Free plan stops at 20 products.
 */

let db: TestDatabase;
const ids = { admin: "", owner: "", staff: "", viewer: "", other: "", shop: "", otherShop: "" };

async function count(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await s.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return rows[0].n;
}

const keys = (shop: string, type: string) =>
  db.asService<{ key: string }>(
    "select key from categories where business_id = $1 and type = $2 and key is not null order by sort, key",
    [shop, type],
  ).then((result) => result.rows.map((row) => row.key));

const categoryId = async (shop: string, type: string, key: string) =>
  (await db.asService<{ id: string }>("select id from categories where business_id = $1 and type = $2 and key = $3", [shop, type, key])).rows[0].id;

beforeAll(async () => {
  db = await TestDatabase.create();
  ids.admin = await db.createUser("Admin");
  ids.owner = await db.createUser("Owner");
  ids.staff = await db.createUser("Staff");
  ids.viewer = await db.createUser("Viewer");
  ids.other = await db.createUser("Other Owner");
  await db.asService("update profiles set platform_role = 'admin' where id = $1", [ids.admin]);

  const shop = (owner: string, name: string) =>
    db.as(owner, async (s) => (await s.query<{ id: string }>("insert into businesses (owner_id, name) values ($1, $2) returning id", [owner, name])).rows[0].id);
  ids.shop = await shop(ids.owner, "Main Shop");
  ids.otherShop = await shop(ids.other, "Other Shop");
  await db.asService("insert into business_members (business_id, user_id, role) values ($1, $2, 'staff'), ($1, $3, 'viewer')", [ids.shop, ids.staff, ids.viewer]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Default categories", () => {
  it("a new shop gets the money-in and money-out defaults for a shop, even before it chooses a business type", async () => {
    expect(await keys(ids.shop, "income")).toEqual(["sales", "other_income"]);
    expect(await keys(ids.shop, "expense")).toEqual([
      "stock", "rent", "salary", "electricity", "water", "phone_internet", "repairs",
      "transport", "family_use", "owner_salary", "wastage", "other",
    ]);
    expect(await keys(ids.shop, "product")).toEqual(["general"]);
  });

  it("choosing a business type adds the categories for it (a driver gets Fuel and Service income)", async () => {
    await db.as(ids.other, (s) => s.query("update businesses set business_type = 'transport' where id = $1", [ids.otherShop]));
    expect(await keys(ids.otherShop, "expense")).toEqual(expect.arrayContaining(["fuel", "rent", "other"]));
    expect(await keys(ids.otherShop, "income")).toContain("service_income");
  });

  it("Transport, Family use, Owner salary and Wastage count as hidden costs; nothing else does", async () => {
    const { rows } = await db.asService<{ key: string }>(
      "select key from categories where business_id = $1 and counts_as = 'hidden_cost' order by key",
      [ids.shop],
    );
    expect(rows.map((row) => row.key)).toEqual(["family_use", "owner_salary", "transport", "wastage"]);
  });

  it("only expense categories can be hidden costs", async () => {
    await expect(
      db.as(ids.owner, (s) => s.query("update categories set counts_as = 'hidden_cost' where business_id = $1 and key = 'sales'", [ids.shop])),
    ).rejects.toThrow();
  });
});

describe("Who can see and change categories", () => {
  it("members read their shop's categories; another shop's owner and the Admin read none of them", async () => {
    for (const who of [ids.owner, ids.staff, ids.viewer]) {
      expect(await db.as(who, (s) => count(s, "select 1 from categories where business_id = $1", [ids.shop]))).toBeGreaterThan(10);
    }
    expect(await db.as(ids.other, (s) => count(s, "select 1 from categories where business_id = $1", [ids.shop]))).toBe(0);
    expect(await db.as(ids.admin, (s) => count(s, "select 1 from categories where business_id is not null"))).toBe(0);
  });

  it("everyone can read the default list; only the Admin can change it", async () => {
    expect(await db.as(null, (s) => count(s, "select 1 from categories where business_id is null"))).toBe(18);
    expect((await db.as(ids.owner, (s) => s.query("update categories set icon = 'x' where business_id is null"))).affectedRows).toBe(0);
    expect((await db.as(ids.admin, (s) => s.query("update categories set icon = 'package' where business_id is null and key = 'stock'"))).affectedRows).toBe(1);
  });

  it("the owner adds, renames and hides categories; staff and viewers cannot", async () => {
    await db.as(ids.owner, (s) =>
      s.query("insert into categories (business_id, type, name, icon, color) values ($1, 'expense', 'Tea for workers', 'cup', 'orange')", [ids.shop]),
    );
    await db.as(ids.owner, (s) => s.query("update categories set name = 'Goods bought' where business_id = $1 and key = 'stock'", [ids.shop]));
    await db.as(ids.owner, (s) => s.query("update categories set archived = true where business_id = $1 and key = 'water'", [ids.shop]));
    for (const who of [ids.staff, ids.viewer, ids.other]) {
      expect((await db.as(who, (s) => s.query("update categories set name = 'Hacked' where business_id = $1", [ids.shop]))).affectedRows).toBe(0);
      await expect(db.as(who, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'expense', 'Sneaky')", [ids.shop]))).rejects.toThrow(/row-level security/);
    }
  });

  it("an owner cannot add a category to someone else's shop or edit the defaults", async () => {
    await expect(db.as(ids.other, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'expense', 'X')", [ids.shop]))).rejects.toThrow(/row-level security/);
    await expect(db.as(ids.owner, (s) => s.query("insert into categories (business_id, type, name) values (null, 'expense', 'X')"))).rejects.toThrow(/row-level security/);
  });

  it("names are unique within the shop and type, ignoring capitals (Tea = tea)", async () => {
    await expect(
      db.as(ids.owner, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'expense', 'TEA FOR WORKERS')", [ids.shop])),
    ).rejects.toThrow(/duplicate|unique/);
    // The same name in another type or another shop is fine.
    await db.as(ids.owner, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'income', 'Tea for workers')", [ids.shop]));
    await db.as(ids.other, (s) => s.query("insert into categories (business_id, type, name) values ($1, 'expense', 'Tea for workers')", [ids.otherShop]));
  });

  it("a rename keeps the key, so reports and translations stay correct", async () => {
    const { rows } = await db.asService<{ key: string; name: string }>("select key, name from categories where business_id = $1 and name = 'Goods bought'", [ids.shop]);
    expect(rows).toEqual([{ key: "stock", name: "Goods bought" }]);
  });
});

describe("Entries point to their own shop's category and product", () => {
  const insert = (who: string, shop: string, type: string, extra: { category_id?: string | null; product_id?: string | null; category?: string | null }) =>
    db.as(who, (s) =>
      s.query(
        `insert into entries (business_id, type, category, category_id, product_id, quantity, amount_cents, entry_date)
         values ($1, $2, $3, $4, $5, $6, 1000, current_date)`,
        [shop, type, extra.category ?? null, extra.category_id ?? null, extra.product_id ?? null, extra.product_id ? 2 : null],
      ),
    );

  it("accepts an entry with a category of the same shop and type", async () => {
    await insert(ids.owner, ids.shop, "expense", { category_id: await categoryId(ids.shop, "expense", "rent") });
    await insert(ids.owner, ids.shop, "income", { category_id: await categoryId(ids.shop, "income", "sales") });
  });

  it("refuses a category from another shop, or of the wrong type", async () => {
    await expect(
      insert(ids.owner, ids.shop, "expense", { category_id: await categoryId(ids.otherShop, "expense", "rent") }),
    ).rejects.toThrow(/category_not_in_shop/);
    await expect(
      insert(ids.owner, ids.shop, "income", { category_id: await categoryId(ids.shop, "expense", "rent") }),
    ).rejects.toThrow(/category_not_in_shop/);
  });

  it("needs a category: the old key or a category id", async () => {
    await expect(insert(ids.owner, ids.shop, "expense", {})).rejects.toThrow(/entries_has_category|check/);
    await insert(ids.owner, ids.shop, "expense", { category: "other" });
  });

  it("a category in use cannot be deleted, only hidden", async () => {
    const rent = await categoryId(ids.shop, "expense", "rent");
    await expect(db.as(ids.owner, (s) => s.query("delete from categories where id = $1", [rent]))).rejects.toThrow(/foreign key|violates/);
  });

  it("accepts a product of the same shop with a quantity, and refuses another shop's product", async () => {
    const mine = (await db.as(ids.owner, (s) => s.query<{ id: string }>("insert into products (business_id, name, cost_cents, price_cents) values ($1, 'Soap', 8500, 11000) returning id", [ids.shop]))).rows[0].id;
    const theirs = (await db.as(ids.other, (s) => s.query<{ id: string }>("insert into products (business_id, name, cost_cents, price_cents) values ($1, 'Rice', 100, 200) returning id", [ids.otherShop]))).rows[0].id;
    await insert(ids.owner, ids.shop, "income", { category_id: await categoryId(ids.shop, "income", "sales"), product_id: mine });
    await expect(
      insert(ids.owner, ids.shop, "income", { category_id: await categoryId(ids.shop, "income", "sales"), product_id: theirs }),
    ).rejects.toThrow(/product_not_in_shop/);
  });
});

describe("Products", () => {
  const add = (who: string, shop: string, values: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = { name: "Item", kind: "own", cost_cents: 100, price_cents: 200, ...values };
    return db.as(who, (s) =>
      s.query(
        "insert into products (business_id, name, kind, company_name, cost_cents, price_cents, category_id, unit, archived) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [shop, row.name, row.kind, row.company_name ?? null, row.cost_cents, row.price_cents, row.category_id ?? null, row.unit ?? "piece", row.archived ?? false],
      ),
    );
  };

  it("a company product needs a company name; a made-by-me product does not", async () => {
    await expect(add(ids.owner, ids.shop, { name: "Lifebuoy", kind: "company" })).rejects.toThrow(/company_name_required/);
    await expect(add(ids.owner, ids.shop, { name: "Lifebuoy", kind: "company", company_name: "   " })).rejects.toThrow(/company_name_required/);
    await add(ids.owner, ids.shop, { name: "Lifebuoy", kind: "company", company_name: "Unilever" });
    await add(ids.owner, ids.shop, { name: "Kottu packet" });
  });

  it("the product's category must be a product category of the same shop", async () => {
    await add(ids.owner, ids.shop, { name: "General item", category_id: await categoryId(ids.shop, "product", "general") });
    await expect(add(ids.owner, ids.shop, { name: "Bad 1", category_id: await categoryId(ids.shop, "expense", "rent") })).rejects.toThrow(/category_not_in_shop/);
    await expect(add(ids.owner, ids.shop, { name: "Bad 2", category_id: await categoryId(ids.otherShop, "product", "general") })).rejects.toThrow(/category_not_in_shop/);
  });

  it("staff and viewers can read products but only the owner can add or change them", async () => {
    for (const who of [ids.owner, ids.staff, ids.viewer]) {
      expect(await db.as(who, (s) => count(s, "select 1 from products"))).toBeGreaterThan(0);
    }
    expect(await db.as(ids.other, (s) => count(s, "select 1 from products where business_id = $1", [ids.shop]))).toBe(0);
    expect(await db.as(ids.admin, (s) => count(s, "select 1 from products"))).toBe(0);
    await expect(add(ids.staff, ids.shop)).rejects.toThrow(/row-level security/);
    await expect(add(ids.viewer, ids.shop)).rejects.toThrow(/row-level security/);
    expect((await db.as(ids.staff, (s) => s.query("update products set name = 'Hacked'"))).affectedRows).toBe(0);
  });

  it("the Free plan allows 20 active products; archived ones do not count", async () => {
    const active = async () => (await db.asService<{ n: number }>("select count(*)::int as n from products where business_id = $1 and not archived", [ids.shop])).rows[0].n;
    while ((await active()) < 20) await add(ids.owner, ids.shop, { name: `Filler ${await active()}` });
    await expect(add(ids.owner, ids.shop, { name: "The 21st" })).rejects.toThrow(/free_limit_products/);

    await db.as(ids.owner, (s) => s.query("update products set archived = true where name = 'Filler 5'"));
    await add(ids.owner, ids.shop, { name: "The 21st now fits" });
    await expect(add(ids.owner, ids.shop, { name: "The 22nd" })).rejects.toThrow(/free_limit_products/);
  });

  it("Pro shops have no limit", async () => {
    await db.asService(
      `insert into subscriptions (user_id, plan_code, gateway, status, currency, current_period_end)
       values ($1, 'pro_monthly', 'paddle', 'active', 'USD', now() + interval '20 days')`,
      [ids.owner],
    );
    await add(ids.owner, ids.shop, { name: "Beyond the limit" });
  });

  it("suggests the company names already used in the shop, to members only", async () => {
    const names = (who: string, shop: string) =>
      db.as(who, async (s) => (await s.query<{ names: string[] }>("select my_company_names($1) as names", [shop])).rows[0].names);
    expect(await names(ids.owner, ids.shop)).toEqual(["Unilever"]);
    expect(await names(ids.staff, ids.shop)).toEqual(["Unilever"]);
    expect(await names(ids.other, ids.shop)).toEqual([]);
  });
});
