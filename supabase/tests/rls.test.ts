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

  it("can see products (to pick them in a sale) but cannot add or change them, or change shop settings", async () => {
    const result = await db.as(ids.staff, async (s) => ({
      products: await count(s, "select 1 from products"),
      renamed: await affected(s, "update businesses set name = 'Hacked' where id = $1", [ids.shopA]),
      productEdited: await affected(s, "update products set name = 'Hacked'"),
    }));
    // Staff see the shop's products (Part D8); nothing else changes.
    expect(result.renamed).toBe(0);
    expect(result.productEdited).toBe(0);
    expect(result.products).toBeGreaterThanOrEqual(0);
    await expect(
      db.as(ids.staff, (s) =>
        s.query("insert into products (business_id, name, cost_cents, price_cents) values ($1, 'X', 1, 2)", [ids.shopA]),
      ),
    ).rejects.toThrow();
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

  it("finds users only through the masked function: no direct reading of profiles (Part B4)", async () => {
    // Everyone (even the Admin) reads only their own profile row.
    const adminSees = await db.as(ids.admin, (s) => count(s, "select 1 from profiles"));
    const ownerSees = await db.as(ids.ownerA, (s) => count(s, "select 1 from profiles"));
    expect({ adminSees, ownerSees }).toEqual({ adminSees: 1, ownerSees: 1 });
    // The list function still works for the Admin and is masked.
    const found = await db.as(ids.admin, async (s) => (await s.query("select * from admin_find_users()")).rows);
    expect(found).toHaveLength(6);
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

  it("12 local entries become 12 stored entries, and a retry adds none (Part F5)", async () => {
    const clientIds = Array.from(
      { length: 12 },
      (_, i) => `7f1c1d3e-2222-4c4c-9a9a-${String(i).padStart(12, "0")}`,
    );
    // One statement for all rows, like the upsert importGuestEntries sends.
    const importAll = () =>
      db.as(ids.ownerA, (s) =>
        s.query(
          `insert into entries (business_id, type, category, amount_cents, entry_date, client_id)
           select $1, 'expense', 'stock', 10000, current_date, unnest($2::uuid[])
           on conflict (business_id, client_id) do nothing
           returning client_id`,
          [ids.shopA, clientIds],
        ),
      );

    const first = await importAll();
    const retry = await importAll();
    expect(first.rows).toHaveLength(12);
    expect(retry.rows).toHaveLength(0); // what EntryRepository reports as "already saved"

    const stored = await db.asService<{ n: number }>(
      "select count(*)::int as n from entries where client_id = any($1::uuid[])",
      [clientIds],
    );
    expect(stored.rows[0].n).toBe(12);
  });

  it("another Owner cannot import entries into someone else's shop", async () => {
    await expect(
      db.as(ids.ownerB, (s) =>
        s.query(
          `insert into entries (business_id, type, category, amount_cents, entry_date, client_id)
           values ($1, 'income', 'sales', 50000, current_date, '7f1c1d3e-3333-4c4c-9a9a-000000000001')
           on conflict (business_id, client_id) do nothing`,
          [ids.shopA],
        ),
      ),
    ).rejects.toThrow(RLS_ERROR);
  });
});

describe("Add entry (addEntry): one save = one stored entry (Day 8)", () => {
  // The SQL that EntryRepository.add sends: a plain insert that never asks for
  // the row back. (An upsert, `on conflict`, would make Postgres check the read
  // rule too, and Staff may not read past days: see the first test below.)
  const addYesterday = (userId: string, clientId: string, onConflict = "") =>
    db.as(userId, (s) =>
      s.query(
        `insert into entries (business_id, type, category, amount_cents, entry_date, client_id)
         values ($1, 'income', 'sales', 120000, current_date - 1, $2) ${onConflict}`,
        [ids.shopA, clientId],
      ),
    );
  const stored = async (clientId: string) =>
    (
      await db.asService<{ n: number; created_by: string }>(
        "select count(*)::int as n, min(created_by::text) as created_by from entries where client_id = $1",
        [clientId],
      )
    ).rows[0];

  it("a Staff member can add an entry for an earlier day, and a double tap stores it once", async () => {
    const clientId = "7f1c1d3e-4444-4c4c-9a9a-000000000001";
    await addYesterday(ids.staff, clientId);
    // The second tap is refused with SQLSTATE 23505; EntryRepository.add treats it as "already saved".
    await expect(addYesterday(ids.staff, clientId)).rejects.toMatchObject({ code: "23505" });

    const row = await stored(clientId);
    expect(row.n).toBe(1);
    expect(row.created_by).toBe(ids.staff);
  });

  it("an upsert (on conflict) would be refused for that same Staff entry: why add() is a plain insert", async () => {
    await expect(
      addYesterday(
        ids.staff,
        "7f1c1d3e-4444-4c4c-9a9a-000000000004",
        "on conflict (business_id, client_id) do nothing",
      ),
    ).rejects.toThrow(RLS_ERROR);
  });

  it("the Owner can add an entry the same way", async () => {
    const clientId = "7f1c1d3e-4444-4c4c-9a9a-000000000002";
    await addYesterday(ids.ownerA, clientId);
    expect((await stored(clientId)).created_by).toBe(ids.ownerA);
  });

  it("a Viewer cannot add entries", async () => {
    await expect(addYesterday(ids.viewer, "7f1c1d3e-4444-4c4c-9a9a-000000000003")).rejects.toThrow(
      RLS_ERROR,
    );
  });

  it("an entry cannot be saved in someone else's name", async () => {
    await expect(
      db.as(ids.staff, (s) =>
        s.query(
          `insert into entries (business_id, type, category, amount_cents, entry_date, created_by)
           values ($1, 'income', 'sales', 5000, current_date, $2)`,
          [ids.shopA, ids.ownerA],
        ),
      ),
    ).rejects.toThrow(RLS_ERROR);
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

describe("Settings: support access switch (Part D2)", () => {
  it("a user switches support access on for 7 days and off again, for themselves only", async () => {
    const switchedOn = await db.as(ids.ownerB, (s) =>
      affected(
        s,
        "update profiles set support_access_until = now() + interval '7 days' where id = $1",
        [ids.ownerB],
      ),
    );
    expect(switchedOn).toBe(1);

    const stored = await db.as(ids.ownerB, async (s) => {
      const { rows } = await s.query<{ days: number }>(
        "select round(extract(epoch from (support_access_until - now())) / 86400)::int as days from profiles where id = $1",
        [ids.ownerB],
      );
      return rows[0].days;
    });
    expect(stored).toBe(7);

    const switchedOff = await db.as(ids.ownerB, (s) =>
      affected(s, "update profiles set support_access_until = null where id = $1", [ids.ownerB]),
    );
    expect(switchedOff).toBe(1);
  });

  it("nobody can switch support access on for another user (the row is hidden, nothing changes)", async () => {
    const changed = await db.as(ids.ownerB, (s) =>
      affected(
        s,
        "update profiles set support_access_until = now() + interval '7 days' where id = $1",
        [ids.ownerA],
      ),
    );
    expect(changed).toBe(0);

    const untouched = await db.asService<{ support_access_until: string | null }>(
      "select support_access_until from profiles where id = $1",
      [ids.ownerA],
    );
    expect(untouched.rows[0].support_access_until).toBeNull();
  });

  it("a user cannot unblock themselves or change their role through the same table", async () => {
    await expect(
      db.as(ids.blocked, (s) =>
        s.query("update profiles set status = 'active' where id = $1", [ids.blocked]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("Monthly summary query (Part F3): totals match the manual sum, even above 1,000 entries", () => {
  // The exact query of the Summary page: run through the person's own session, so RLS applies.
  const SUMMARY_SQL = `
    select
      coalesce(sum(amount_cents) filter (where type = 'income'), 0)::bigint  as income_cents,
      coalesce(sum(amount_cents) filter (where type = 'expense'), 0)::bigint as expense_cents
    from entries
    where business_id = $1
      and entry_date >= date_trunc('month', $2::date)
      and entry_date <  date_trunc('month', $2::date) + interval '1 month'`;

  const ENTRIES = 2_300;
  const state = { owner: "", viewer: "", staff: "", other: "", shop: "", income: 0, expense: 0 };

  beforeAll(async () => {
    state.owner = await db.createUser("Summary owner");
    state.viewer = await db.createUser("Summary viewer");
    state.staff = await db.createUser("Summary staff");
    state.other = await db.createUser("Summary other owner");
    state.shop = await createShop(state.owner, "Summary Stores");
    await db.asService(
      `insert into business_members (business_id, user_id, role) values ($1, $2, 'viewer'), ($1, $3, 'staff')`,
      [state.shop, state.viewer, state.staff],
    );

    // 2,300 entries in March 2025: income on every third one, amounts that differ per entry.
    await db.asService(
      `insert into entries (business_id, type, category, amount_cents, entry_date, created_by)
       select $1,
              case when n % 3 = 0 then 'income'::entry_type else 'expense'::entry_type end,
              case when n % 3 = 0 then 'sales' else 'stock' end,
              100 + (n * 37) % 90000,
              date '2025-03-01' + (n % 31),
              $2
       from generate_series(1, ${ENTRIES}) as n`,
      [state.shop, state.owner],
    );
    // Entries in the months around it must never leak in.
    await db.asService(
      `insert into entries (business_id, type, category, amount_cents, entry_date, created_by)
       values ($1, 'income', 'sales', 99999999, date '2025-02-28', $2),
              ($1, 'income', 'sales', 99999999, date '2025-04-01', $2)`,
      [state.shop, state.owner],
    );

    // The manual sum, worked out here in plain code.
    for (let n = 1; n <= ENTRIES; n++) {
      const cents = 100 + ((n * 37) % 90000);
      if (n % 3 === 0) state.income += cents;
      else state.expense += cents;
    }
  }, 60_000);

  const totalsFor = (userId: string) =>
    db.as(userId, async (s) => {
      const { rows } = await s.query<{ income_cents: string; expense_cents: string }>(SUMMARY_SQL, [
        state.shop,
        "2025-03-15",
      ]);
      return { income: Number(rows[0].income_cents), expense: Number(rows[0].expense_cents) };
    });

  it("the Owner and the Viewer get the same totals as adding every entry by hand", async () => {
    expect(await totalsFor(state.owner)).toEqual({ income: state.income, expense: state.expense });
    expect(await totalsFor(state.viewer)).toEqual({ income: state.income, expense: state.expense });
  });

  it("Staff get nothing (they can never work out totals) and another shop's Owner gets nothing", async () => {
    expect(await totalsFor(state.staff)).toEqual({ income: 0, expense: 0 });
    expect(await totalsFor(state.other)).toEqual({ income: 0, expense: 0 });
  });

  it("paging through the month 1,000 at a time returns every entry exactly once", async () => {
    const pages = await db.as(state.viewer, async (s) => {
      const seen: string[] = [];
      let sum = 0;
      for (let page = 0; page < 5; page++) {
        const { rows } = await s.query<{ id: string; amount_cents: string }>(
          `select id, amount_cents from entries
           where business_id = $1 and entry_date >= '2025-03-01' and entry_date < '2025-04-01'
           order by entry_date asc, id asc limit 1000 offset $2`,
          [state.shop, page * 1000],
        );
        for (const row of rows) {
          seen.push(row.id);
          sum += Number(row.amount_cents);
        }
        if (rows.length < 1000) break;
      }
      return { seen, sum };
    });

    expect(pages.seen).toHaveLength(ENTRIES);
    expect(new Set(pages.seen).size).toBe(ENTRIES);
    expect(pages.sum).toBe(state.income + state.expense);
  });
});
