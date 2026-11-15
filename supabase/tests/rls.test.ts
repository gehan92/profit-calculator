import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Row Level Security tests — Part F5 testing checklist ("RLS: two Owners,
 * Staff, Viewer, Admin") and the permission matrix in Part B2.
 * These must pass before any release.
 */

const RLS_ERROR = /row-level security/;

let db: TestDatabase;

/** Ids created once in `beforeAll`. */
const ids = {
  ownerA: "",
  ownerB: "",
  staff: "",
  viewer: "",
  admin: "",
  blocked: "",
  shopA: "",
  shopB: "",
  staffInviteToken: "",
  ownerAEntry: "",
  ownerBEntry: "",
  staffEntryToday: "",
};

// --------------------------------------------------------------------- helpers

async function createShop(ownerId: string, name: string): Promise<string> {
  return db.as(ownerId, async (s) => {
    const { rows } = await s.query<{ id: string }>(
      "insert into businesses (owner_id, name) values ($1, $2) returning id",
      [ownerId, name],
    );
    return rows[0].id;
  });
}

async function addEntry(
  s: Session,
  shopId: string,
  type: "income" | "expense",
  category: string,
  amountCents: number,
  daysAgo = 0,
): Promise<string> {
  const { rows } = await s.query<{ id: string }>(
    `insert into entries (business_id, type, category, amount_cents, entry_date)
     values ($1, $2, $3, $4, current_date - $5::int) returning id`,
    [shopId, type, category, amountCents, daysAgo],
  );
  return rows[0].id;
}

async function count(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await s.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return rows[0].n;
}

/** Runs an UPDATE/DELETE and returns how many rows it really changed. */
async function affected(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const result = await s.query(sql, params);
  return result.affectedRows ?? 0;
}

// ----------------------------------------------------------------------- setup

beforeAll(async () => {
  db = await TestDatabase.create();

  ids.ownerA = await db.createUser("Kamala");
  ids.ownerB = await db.createUser("Sunil");
  ids.staff = await db.createUser("Nimal");
  ids.viewer = await db.createUser("Accountant");
  ids.admin = await db.createUser("Gehan");
  ids.blocked = await db.createUser("Blocked user");

  await db.asService("update profiles set platform_role = 'admin' where id = $1", [ids.admin]);
  await db.asService("update profiles set status = 'blocked' where id = $1", [ids.blocked]);

  ids.shopA = await createShop(ids.ownerA, "Kamala Stores");
  ids.shopB = await createShop(ids.ownerB, "Sunil Traders");

  // Owner A invites Staff and Viewer; they accept through accept_invite().
  const invite = (role: "staff" | "viewer") =>
    db.as(ids.ownerA, async (s) => {
      const { rows } = await s.query<{ token: string }>(
        "insert into invites (business_id, role) values ($1, $2) returning token",
        [ids.shopA, role],
      );
      return rows[0].token;
    });

  ids.staffInviteToken = await invite("staff");
  const viewerToken = await invite("viewer");
  await db.as(ids.staff, (s) => s.query("select accept_invite($1)", [ids.staffInviteToken]));
  await db.as(ids.viewer, (s) => s.query("select accept_invite($1)", [viewerToken]));

  // Shop A: owner records today's sales and stock; staff records one sale today, one yesterday.
  ids.ownerAEntry = await db.as(ids.ownerA, async (s) => {
    const id = await addEntry(s, ids.shopA, "income", "sales", 2_500_000);
    await addEntry(s, ids.shopA, "expense", "stock", 1_500_000);
    await s.query(
      "insert into products (business_id, name, cost_cents, price_cents) values ($1, 'Soap', 8500, 11000)",
      [ids.shopA],
    );
    return id;
  });

  ids.staffEntryToday = await db.as(ids.staff, async (s) => {
    const id = await addEntry(s, ids.shopA, "income", "sales", 250_000);
    // Yesterday's entry: Staff may save it but not read it back, so no RETURNING here.
    await s.query(
      `insert into entries (business_id, type, category, amount_cents, entry_date)
       values ($1, 'income', 'sales', 120000, current_date - 1)`,
      [ids.shopA],
    );
    return id;
  });

  ids.ownerBEntry = await db.as(ids.ownerB, (s) =>
    addEntry(s, ids.shopB, "income", "sales", 900_000),
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
});

// ----------------------------------------------------------------------- tests

describe("Two owners: no data leaks between shops", () => {
  it("Owner A sees only their own shop", async () => {
    const shops = await db.as(ids.ownerA, (s) => s.query<{ id: string }>("select id from businesses"));
    expect(shops.rows.map((row) => row.id)).toEqual([ids.shopA]);
  });

  it("Owner A cannot read Owner B's entries", async () => {
    const n = await db.as(ids.ownerA, (s) =>
      count(s, "select 1 from entries where business_id = $1", [ids.shopB]),
    );
    expect(n).toBe(0);
  });

  it("Owner A cannot add an entry to Owner B's shop", async () => {
    await expect(
      db.as(ids.ownerA, (s) => addEntry(s, ids.shopB, "income", "sales", 100)),
    ).rejects.toThrow(RLS_ERROR);
  });

  it("Owner A cannot edit or delete Owner B's entries", async () => {
    const changed = await db.as(ids.ownerA, async (s) => {
      const updated = await affected(s, "update entries set amount_cents = 1 where id = $1", [
        ids.ownerBEntry,
      ]);
      const deleted = await affected(s, "delete from entries where id = $1", [ids.ownerBEntry]);
      return updated + deleted;
    });
    expect(changed).toBe(0);

    const stillThere = await db.asService<{ amount_cents: number }>(
      "select amount_cents from entries where id = $1",
      [ids.ownerBEntry],
    );
    expect(Number(stillThere.rows[0].amount_cents)).toBe(900_000);
  });
});

describe("Staff: add entries, see only their own entries from today", () => {
  it("sees only their own entry from today", async () => {
    const rows = await db.as(ids.staff, (s) => s.query<{ id: string }>("select id from entries"));
    expect(rows.rows.map((row) => row.id)).toEqual([ids.staffEntryToday]);
  });

  it("cannot work out shop totals with the monthly summary query", async () => {
    const summary = await db.as(ids.staff, (s) =>
      s.query<{ income_cents: string; expense_cents: string }>(
        `select
           coalesce(sum(amount_cents) filter (where type = 'income'), 0)  as income_cents,
           coalesce(sum(amount_cents) filter (where type = 'expense'), 0) as expense_cents
         from entries
         where business_id = $1
           and entry_date >= date_trunc('month', current_date)
           and entry_date <  date_trunc('month', current_date) + interval '1 month'`,
        [ids.shopA],
      ),
    );
    // Only their own sale today is visible: no owner sales, no expenses, no profit.
    expect(Number(summary.rows[0].income_cents)).toBe(250_000);
    expect(Number(summary.rows[0].expense_cents)).toBe(0);
  });

  it("can edit their own entry from today", async () => {
    const n = await db.as(ids.staff, (s) =>
      affected(s, "update entries set note = 'fixed typo' where id = $1", [ids.staffEntryToday]),
    );
    expect(n).toBe(1);
  });

  it("cannot move their entry to another day", async () => {
    await expect(
      db.as(ids.staff, (s) =>
        s.query("update entries set entry_date = current_date - 1 where id = $1", [
          ids.staffEntryToday,
        ]),
      ),
    ).rejects.toThrow(RLS_ERROR);
  });

  it("cannot edit the owner's entries or delete anything", async () => {
    const changed = await db.as(ids.staff, async (s) => {
      const edited = await affected(s, "update entries set amount_cents = 1 where id = $1", [
        ids.ownerAEntry,
      ]);
      const deleted = await affected(s, "delete from entries where id = $1", [ids.staffEntryToday]);
      return edited + deleted;
    });
    expect(changed).toBe(0);
  });

  it("cannot see products or change shop settings", async () => {
    const result = await db.as(ids.staff, async (s) => ({
      products: await count(s, "select 1 from products"),
      renamed: await affected(s, "update businesses set name = 'Hacked' where id = $1", [ids.shopA]),
    }));
    expect(result).toEqual({ products: 0, renamed: 0 });
  });
});

describe("Viewer: read everything in the shop, change nothing", () => {
  it("can read all of the shop's entries and products", async () => {
    const result = await db.as(ids.viewer, async (s) => ({
      entries: await count(s, "select 1 from entries where business_id = $1", [ids.shopA]),
      products: await count(s, "select 1 from products"),
    }));
    expect(result).toEqual({ entries: 4, products: 1 });
  });

  it("cannot add entries or products", async () => {
    await expect(
      db.as(ids.viewer, (s) => addEntry(s, ids.shopA, "income", "sales", 100)),
    ).rejects.toThrow(RLS_ERROR);
    await expect(
      db.as(ids.viewer, (s) =>
        s.query(
          "insert into products (business_id, name, cost_cents, price_cents) values ($1, 'X', 1, 2)",
          [ids.shopA],
        ),
      ),
    ).rejects.toThrow(RLS_ERROR);
  });

  it("cannot edit or delete entries, or change the shop", async () => {
    const changed = await db.as(ids.viewer, async (s) => {
      const edited = await affected(s, "update entries set amount_cents = 1 where business_id = $1", [
        ids.shopA,
      ]);
      const deleted = await affected(s, "delete from entries where business_id = $1", [ids.shopA]);
      const renamed = await affected(s, "update businesses set name = 'X' where id = $1", [
        ids.shopA,
      ]);
      return edited + deleted + renamed;
    });
    expect(changed).toBe(0);
  });
});

describe("Admin: totals only, never one shop's money", () => {
  it("cannot read any entries or products", async () => {
    const result = await db.as(ids.admin, async (s) => ({
      entries: await count(s, "select 1 from entries"),
      products: await count(s, "select 1 from products"),
    }));
    expect(result).toEqual({ entries: 0, products: 0 });
  });

  it("gets website totals from admin_stats()", async () => {
    const stats = await db.as(ids.admin, (s) =>
      s.query<{ stats: Record<string, number> }>("select admin_stats() as stats"),
    );
    expect(stats.rows[0].stats).toMatchObject({ users_total: 6, businesses_total: 2 });
  });

  it("admin_stats() is forbidden for everyone else", async () => {
    await expect(db.as(ids.ownerA, (s) => s.query("select admin_stats()"))).rejects.toThrow(
      /forbidden/,
    );
  });

  it("can search all users (account info), while normal users see only themselves", async () => {
    const adminSees = await db.as(ids.admin, (s) => count(s, "select 1 from profiles"));
    const ownerSees = await db.as(ids.ownerA, (s) => count(s, "select 1 from profiles"));
    expect({ adminSees, ownerSees }).toEqual({ adminSees: 6, ownerSees: 1 });
  });
});

describe("Account safety", () => {
  it("a user can change their name but cannot make themselves admin", async () => {
    const renamed = await db.as(ids.ownerA, (s) =>
      affected(s, "update profiles set full_name = 'Kamala Perera' where id = $1", [ids.ownerA]),
    );
    expect(renamed).toBe(1);

    await expect(
      db.as(ids.ownerA, (s) =>
        s.query("update profiles set platform_role = 'admin' where id = $1", [ids.ownerA]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("a blocked user cannot create a shop", async () => {
    await expect(createShop(ids.blocked, "Blocked shop")).rejects.toThrow(RLS_ERROR);
  });

  it("a blocked user cannot accept an invite", async () => {
    const token = await db.as(ids.ownerA, async (s) => {
      const { rows } = await s.query<{ token: string }>(
        "insert into invites (business_id, role) values ($1, 'viewer') returning token",
        [ids.shopA],
      );
      return rows[0].token;
    });
    await expect(
      db.as(ids.blocked, (s) => s.query("select accept_invite($1)", [token])),
    ).rejects.toThrow(/not_allowed/);
  });

  it("an invite link works only once", async () => {
    await expect(
      db.as(ids.ownerB, (s) => s.query("select accept_invite($1)", [ids.staffInviteToken])),
    ).rejects.toThrow(/invite_invalid/);
  });

  it("an owner cannot remove themselves from their own shop", async () => {
    const removed = await db.as(ids.ownerA, (s) =>
      affected(s, "delete from business_members where business_id = $1 and user_id = $2", [
        ids.shopA,
        ids.ownerA,
      ]),
    );
    expect(removed).toBe(0);
  });
});

describe("Guest import: no duplicates on retry (Part D2)", () => {
  it("importing the same local entries twice stores them once", async () => {
    const clientId = "7f1c1d3e-1111-4c4c-9a9a-000000000001";
    const importOnce = () =>
      db.as(ids.ownerA, (s) =>
        s.query(
          `insert into entries (business_id, type, category, amount_cents, entry_date, client_id)
           values ($1, 'income', 'sales', 50000, current_date, $2)
           on conflict (business_id, client_id) do nothing`,
          [ids.shopA, clientId],
        ),
      );

    await importOnce();
    await importOnce();

    const stored = await db.asService<{ n: number }>(
      "select count(*)::int as n from entries where client_id = $1",
      [clientId],
    );
    expect(stored.rows[0].n).toBe(1);
  });
});

describe("Feedback: anyone can send, only the team can read", () => {
  it("a guest can send feedback but cannot read any", async () => {
    const seen = await db.as(null, async (s) => {
      await s.query("insert into feedback (message, page) values ('Great tool', '/en')");
      return count(s, "select 1 from feedback");
    });
    expect(seen).toBe(0);
  });

  it("the admin can read it", async () => {
    const seen = await db.as(ids.admin, (s) => count(s, "select 1 from feedback"));
    expect(seen).toBe(1);
  });
});
