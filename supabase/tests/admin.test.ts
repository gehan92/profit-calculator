import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Admin panel database rules (Part D4, Part B3/B4, migrations 0003 and 0005):
 * Admin and Support see account info and COUNTS, never a shop's money;
 * everybody else is refused; only server code (secret key) writes the audit log.
 */

let db: TestDatabase;

const ids = {
  admin: "",
  support: "",
  owner: "",
  other: "",
  blocked: "",
  shop: "",
  otherShop: "",
};

async function count(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await s.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return rows[0].n;
}

async function affected(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const result = await s.query(sql, params);
  return result.affectedRows ?? 0;
}

type UserRow = {
  user_id: string;
  email_masked: string | null;
  phone_masked: string | null;
  platform_role: string;
  status: string;
  tier: string;
  shops_count: number;
  entries_count: number;
  total_count: number;
};

const listUsers = (userId: string | null, search: string | null, limit = 25, offset = 0) =>
  db.as(userId, async (s) => {
    const { rows } = await s.query<UserRow>("select * from admin_find_users($1, $2, $3)", [search, limit, offset]);
    return rows;
  });

beforeAll(async () => {
  db = await TestDatabase.create();

  ids.admin = await db.createUser("Gehan Admin", { email: "gehan@example.com" });
  ids.support = await db.createUser("Helper Support", { email: "helper@example.com" });
  ids.owner = await db.createUser("Kamala Perera", { email: "kamala@example.com", phone: "+94771234567" });
  ids.other = await db.createUser("Sunil Silva", { email: "sunil@shop.lk" });
  ids.blocked = await db.createUser("Blocked Person", { email: "blocked@example.com" });

  await db.asService("update profiles set platform_role = 'admin' where id = $1", [ids.admin]);
  await db.asService("update profiles set platform_role = 'support' where id = $1", [ids.support]);
  await db.asService("update profiles set status = 'blocked' where id = $1", [ids.blocked]);

  const shop = (owner: string, name: string) =>
    db.as(owner, async (s) => {
      const { rows } = await s.query<{ id: string }>(
        "insert into businesses (owner_id, name, locale) values ($1, $2, 'si') returning id",
        [owner, name],
      );
      return rows[0].id;
    });
  ids.shop = await shop(ids.owner, "Kamala Stores");
  ids.otherShop = await shop(ids.other, "Sunil Traders");
  await db.asService(
    `insert into subscriptions (user_id, plan_code, gateway, status, currency, current_period_end)
     values ($1, 'pro_monthly', 'paddle', 'active', 'USD', now() + interval '30 days')`,
    [ids.other],
  );

  // Kamala has 3 entries with amounts that must never reach the admin.
  await db.as(ids.owner, async (s) => {
    for (const [type, category, cents] of [
      ["income", "sales", 2_500_000],
      ["expense", "stock", 1_500_000],
      ["expense", "rent", 500_000],
    ] as const) {
      await s.query(
        `insert into entries (business_id, type, category, amount_cents, entry_date)
         values ($1, $2, $3, $4, current_date)`,
        [ids.shop, type, category, cents],
      );
    }
  });
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("admin_stats()", () => {
  it("gives the Admin the totals, including the new ones", async () => {
    const stats = await db.as(ids.admin, async (s) => {
      const { rows } = await s.query<{ stats: Record<string, unknown> }>("select admin_stats() as stats");
      return rows[0].stats;
    });
    expect(stats).toMatchObject({
      users_total: 5,
      signups_today: 5,
      signups_7d: 5,
      signups_30d: 5,
      businesses_total: 2,
      pro_businesses: 1,
      blocked_users: 1,
      entries_today: 3,
      weekly_active: 1,
      feedback_new: 0,
      language_split: { si: 2 },
    });
  });

  it.each(["support", "owner", "blocked"] as const)("refuses %s", async (who) => {
    await expect(db.as(ids[who], (s) => s.query("select admin_stats()"))).rejects.toThrow(/forbidden/);
  });

  it("refuses a guest", async () => {
    await expect(db.as(null, (s) => s.query("select admin_stats()"))).rejects.toThrow(/forbidden/);
  });
});

describe("admin_daily_stats()", () => {
  const days = (userId: string, n?: number) =>
    db.as(userId, async (s) => {
      const { rows } = await s.query<{ day: string; signups: number; active_users: number }>(
        n === undefined ? "select * from admin_daily_stats()" : "select * from admin_daily_stats($1)",
        n === undefined ? [] : [n],
      );
      return rows;
    });

  it("lists 30 days oldest first, today last, with today's signups and active people", async () => {
    const rows = await days(ids.admin);
    expect(rows).toHaveLength(30);
    expect(rows[0].day < rows[29].day).toBe(true);
    expect(rows[29]).toMatchObject({ signups: 5, active_users: 1 });
    expect(rows[0]).toMatchObject({ signups: 0, active_users: 0 });
  });

  it("limits the range to 1–366 days", async () => {
    expect(await days(ids.admin, 0)).toHaveLength(1);
    expect(await days(ids.admin, 7)).toHaveLength(7);
    expect(await days(ids.admin, 5000)).toHaveLength(366);
  });

  it("is for the Admin only", async () => {
    await expect(days(ids.support)).rejects.toThrow(/forbidden/);
    await expect(days(ids.owner)).rejects.toThrow(/forbidden/);
    await expect(db.as(null, (s) => s.query("select * from admin_daily_stats()"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("admin_find_users(): masked contact, exact search (Part B4, migration 0005)", () => {
  it("lists everyone for the Admin with masked contact, tier, status and counts", async () => {
    const rows = await listUsers(ids.admin, null);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.total_count === 5)).toBe(true);

    const kamala = rows.find((row) => row.user_id === ids.owner)!;
    expect(kamala).toMatchObject({
      email_masked: "k***@example.com",
      phone_masked: "+947 *** **67",
      platform_role: "user",
      status: "active",
      tier: "free",
      shops_count: 1,
      entries_count: 3,
    });
    expect(rows.find((row) => row.user_id === ids.other)?.tier).toBe("pro");
    expect(rows.find((row) => row.user_id === ids.blocked)?.status).toBe("blocked");
  });

  it("never returns a full email, a full phone number or a name", async () => {
    const rows = await listUsers(ids.admin, null);
    const text = JSON.stringify(rows);
    expect(text).not.toMatch(/kamala@example\.com|sunil@shop\.lk|\+94771234567|Kamala|Perera|Sunil/);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "created_at", "email_masked", "entries_count", "last_active_at", "phone_masked",
        "platform_role", "shops_count", "status", "tier", "total_count", "user_id",
      ].sort(),
    );
  });

  it("is open to Support too (Part D4: Users — Support, Admin)", async () => {
    expect(await listUsers(ids.support, null)).toHaveLength(5);
  });

  it("finds ONE user by the exact email, phone or user ID, in any letter case", async () => {
    expect((await listUsers(ids.admin, "KAMALA@example.com")).map((row) => row.user_id)).toEqual([ids.owner]);
    expect((await listUsers(ids.admin, "  sunil@shop.lk  ")).map((row) => row.user_id)).toEqual([ids.other]);
    expect((await listUsers(ids.admin, "+94771234567")).map((row) => row.user_id)).toEqual([ids.owner]);
    expect((await listUsers(ids.admin, ids.other.toUpperCase())).map((row) => row.user_id)).toEqual([ids.other]);
  });

  it("does not find anyone by part of an email, a name or a wildcard (no guessing)", async () => {
    for (const text of ["kamala", "SHOP.LK", "771234", "perera", "%", "k_mala", "k%", "example.com"]) {
      expect(await listUsers(ids.admin, text)).toEqual([]);
    }
  });

  it("finds the same user whichever way the phone number is typed (+94…, 94…, 077…, spaces, dashes)", async () => {
    for (const text of ["+94771234567", "94771234567", "0771234567", "+94 77 123 4567", "077-123-4567", " (077) 123 4567 "]) {
      expect((await listUsers(ids.admin, text)).map((row) => row.user_id)).toEqual([ids.owner]);
    }
  });

  it("finds nobody by part of a phone number, a different number or a number with letters", async () => {
    for (const text of ["771234567", "+9477123456", "0771234568", "0771234567x", "94771234567 abc", "077123"]) {
      expect(await listUsers(ids.admin, text)).toEqual([]);
    }
  });

  it("copes with a phone stored the way Supabase really stores it: digits only, no +", async () => {
    // GoTrue saves "94779998888", not "+94779998888".
    await db.asService("update auth.users set phone = '94779998888' where id = $1", [ids.other]);
    try {
      const byPlus = await listUsers(ids.admin, "+94779998888");
      expect(byPlus.map((row) => row.user_id)).toEqual([ids.other]);
      expect(byPlus[0].phone_masked).toBe("+947 *** **88");
      expect((await listUsers(ids.admin, "0779998888")).map((row) => row.user_id)).toEqual([ids.other]);
      const summary = await db.as(ids.admin, async (s) => {
        const { rows } = await s.query<{ result: { phone_masked: string } }>("select admin_user_summary($1) as result", [ids.other]);
        return rows[0].result;
      });
      expect(summary.phone_masked).toBe("+947 *** **88");
    } finally {
      await db.asService("update auth.users set phone = null where id = $1", [ids.other]);
    }
  });

  it("pages through the list and says how many match in total", async () => {
    const first = await listUsers(ids.admin, null, 2, 0);
    const second = await listUsers(ids.admin, null, 2, 2);
    const third = await listUsers(ids.admin, null, 2, 4);
    expect([first.length, second.length, third.length]).toEqual([2, 2, 1]);
    expect(first[0].total_count).toBe(5);
    const all = [...first, ...second, ...third].map((row) => row.user_id);
    expect(new Set(all).size).toBe(5);
  });

  it("refuses ordinary users, blocked users and guests", async () => {
    await expect(listUsers(ids.owner, null)).rejects.toThrow(/forbidden/);
    await expect(listUsers(ids.blocked, null)).rejects.toThrow(/forbidden/);
    await expect(listUsers(null, null)).rejects.toThrow(/permission denied/);
  });

  it("the old functions that showed full contact details are gone", async () => {
    await expect(db.as(ids.admin, (s) => s.query("select * from admin_users(null, 5, 0)"))).rejects.toThrow(
      /does not exist/,
    );
    await expect(
      db.as(ids.admin, (s) => s.query("select admin_user_detail($1)", [ids.owner])),
    ).rejects.toThrow(/does not exist/);
  });
});

describe("admin_user_summary(): one user, masked, counts only", () => {
  const summary = (userId: string | null, target: string) =>
    db.as(userId, async (s) => {
      const { rows } = await s.query<{ result: Record<string, unknown> | null }>(
        "select admin_user_summary($1) as result",
        [target],
      );
      return rows[0].result;
    });

  it("shows masked contact, status, tier, support-access status and counts", async () => {
    expect(await summary(ids.admin, ids.owner)).toMatchObject({
      id: ids.owner,
      email_masked: "k***@example.com",
      phone_masked: "+947 *** **67",
      status: "active",
      platform_role: "user",
      tier: "free",
      support_access_until: null,
      support_access_on: false,
      shops_count: 1,
      // The owner's own 'owner' row is not a shop they joined.
      memberships_count: 0,
      entries_count: 3,
    });
  });

  it("counts a shop the user joined as Staff or Viewer, but not their own", async () => {
    await db.asService("insert into business_members (business_id, user_id, role) values ($1, $2, 'staff')", [ids.shop, ids.other]);
    try {
      expect(await summary(ids.admin, ids.other)).toMatchObject({ shops_count: 1, memberships_count: 1 });
      expect(await summary(ids.admin, ids.owner)).toMatchObject({ shops_count: 1, memberships_count: 0 });
    } finally {
      await db.asService("delete from business_members where business_id = $1 and user_id = $2", [ids.shop, ids.other]);
    }
  });

  it("shows no name, no full contact, no shop name and nothing about money", async () => {
    const text = JSON.stringify(await summary(ids.support, ids.owner));
    expect(text).not.toMatch(/Kamala|Perera|kamala@example\.com|\+94771234567|Stores|amount|cents|note|category|2500000/);
  });

  it("returns null for an unknown user and refuses ordinary users", async () => {
    expect(await summary(ids.admin, "00000000-0000-0000-0000-000000000000")).toBeNull();
    await expect(summary(ids.owner, ids.other)).rejects.toThrow(/forbidden/);
    await expect(summary(null, ids.owner)).rejects.toThrow(/permission denied/);
  });
});

describe("admin_view_user(): the full view only with the user's permission, always logged", () => {
  const view = (userId: string | null, target: string) =>
    db.as(userId, async (s) => {
      const { rows } = await s.query<{ result: Record<string, unknown> }>("select admin_view_user($1) as result", [target]);
      return rows[0].result;
    });
  const auditRows = () =>
    db.asService<{ action: string; actor_id: string; target_user_id: string }>(
      "select action, actor_id, target_user_id from audit_log where action = 'user.view_with_permission'",
    ).then((result) => result.rows);

  it("is refused while the user's support-access switch is off, and nothing is logged", async () => {
    await expect(view(ids.support, ids.owner)).rejects.toThrow(/no_permission/);
    expect(await auditRows()).toEqual([]);
  });

  it("shows the full profile while the switch is on, and writes an audit row first", async () => {
    await db.as(ids.owner, (s) =>
      s.query("update profiles set support_access_until = now() + interval '7 days' where id = $1", [ids.owner]),
    );
    const result = await view(ids.support, ids.owner);
    expect(result).toMatchObject({
      profile: { id: ids.owner, full_name: "Kamala Perera" },
      email: "kamala@example.com",
      phone: "+94771234567",
      shops: [{ name: "Kamala Stores" }],
    });
    // Still no money.
    expect(JSON.stringify(result)).not.toMatch(/amount|cents|2500000/);
    expect(await auditRows()).toEqual([
      { action: "user.view_with_permission", actor_id: ids.support, target_user_id: ids.owner },
    ]);
  });

  it("the user sees when their account was viewed (time only, never who or why)", async () => {
    const log = await db.as(ids.owner, async (s) => (await s.query("select * from my_access_log()")).rows);
    expect(log).toHaveLength(1);
    expect(Object.keys(log[0] as object)).toEqual(["viewed_at"]);
    // Another user's log is empty.
    expect(await db.as(ids.other, async (s) => (await s.query("select * from my_access_log()")).rows)).toEqual([]);
  });

  it("stops working when the switch is turned off again or has run out", async () => {
    await db.as(ids.owner, (s) =>
      s.query("update profiles set support_access_until = null where id = $1", [ids.owner]),
    );
    await expect(view(ids.admin, ids.owner)).rejects.toThrow(/no_permission/);
    await db.asService("update profiles set support_access_until = now() - interval '1 minute' where id = $1", [ids.owner]);
    await expect(view(ids.admin, ids.owner)).rejects.toThrow(/no_permission/);
    await db.asService("update profiles set support_access_until = null where id = $1", [ids.owner]);
  });

  it("refuses ordinary users, blocked users and guests", async () => {
    await expect(view(ids.owner, ids.other)).rejects.toThrow(/forbidden/);
    await expect(view(ids.blocked, ids.owner)).rejects.toThrow(/forbidden/);
    await expect(view(null, ids.owner)).rejects.toThrow(/permission denied/);
  });
});

describe("Support and Admin read nothing directly (Part B4)", () => {
  it("cannot select other people's profiles, shops or memberships", async () => {
    for (const who of [ids.admin, ids.support]) {
      expect(await db.as(who, (s) => count(s, "select 1 from profiles where id <> $1", [who]))).toBe(0);
      expect(await db.as(who, (s) => count(s, "select 1 from businesses"))).toBe(0);
      expect(await db.as(who, (s) => count(s, "select 1 from business_members where user_id <> $1", [who]))).toBe(0);
    }
  });

  it("everyone still reads their own profile, shop and membership", async () => {
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from profiles where id = $1", [ids.owner]))).toBe(1);
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from businesses"))).toBe(1);
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from business_members"))).toBe(1);
  });
});

describe("Admin never reads a shop's money (Part B3)", () => {
  it("Admin and Support cannot select entries or products", async () => {
    expect(await db.as(ids.admin, (s) => count(s, "select 1 from entries"))).toBe(0);
    expect(await db.as(ids.support, (s) => count(s, "select 1 from entries"))).toBe(0);
    expect(await db.as(ids.admin, (s) => count(s, "select 1 from products"))).toBe(0);
  });
});

describe("touch_last_active()", () => {
  it("marks the person active, then not again within the hour", async () => {
    const last = () =>
      db.asService<{ last_active_at: string | null }>(
        "select last_active_at from profiles where id = $1",
        [ids.other],
      ).then((result) => result.rows[0].last_active_at);

    expect(await last()).toBeNull();
    await db.as(ids.other, (s) => s.query("select touch_last_active()"));
    const first = await last();
    expect(first).not.toBeNull();

    await db.as(ids.other, (s) => s.query("select touch_last_active()"));
    expect(await last()).toEqual(first);

    // An old value is refreshed.
    await db.asService("update profiles set last_active_at = now() - interval '2 hours' where id = $1", [ids.other]);
    await db.as(ids.other, (s) => s.query("select touch_last_active()"));
    const refreshed = await last();
    expect(new Date(refreshed!).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("changes only the caller's own row", async () => {
    await db.as(ids.owner, (s) => s.query("select touch_last_active()"));
    const rows = await db.asService<{ id: string; last_active_at: string | null }>(
      "select id, last_active_at from profiles where id in ($1, $2)",
      [ids.owner, ids.blocked],
    );
    expect(rows.rows.find((row) => row.id === ids.owner)?.last_active_at).not.toBeNull();
    expect(rows.rows.find((row) => row.id === ids.blocked)?.last_active_at).toBeNull();
  });

  it("is not open to guests, and users still cannot write last_active_at themselves", async () => {
    await expect(db.as(null, (s) => s.query("select touch_last_active()"))).rejects.toThrow(/permission denied/);
    await expect(
      db.as(ids.owner, (s) => s.query("update profiles set last_active_at = now() where id = $1", [ids.owner])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("Audit log (Part B3: every admin action is logged)", () => {
  it("only server code writes rows: nobody can insert one with a normal login, not even an Admin", async () => {
    for (const who of [ids.admin, ids.support, ids.owner]) {
      await expect(
        db.as(who, (s) => s.query("insert into audit_log (actor_id, action) values ($1, 'user.block')", [who])),
      ).rejects.toThrow(/row-level security/);
    }
  });

  it("only the Admin can read it", async () => {
    await db.asService("insert into audit_log (actor_id, action, target_user_id, details) values ($1, 'user.block', $2, $3)", [
      ids.admin,
      ids.blocked,
      { email: "blocked@example.com" },
    ]);
    expect(await db.as(ids.admin, (s) => count(s, "select 1 from audit_log where action = 'user.block'"))).toBe(1);
    expect(await db.as(ids.support, (s) => count(s, "select 1 from audit_log"))).toBe(0);
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from audit_log"))).toBe(0);
  });

  it("rows stay as history after the Admin's account is deleted", async () => {
    const temp = await db.createUser("Temporary admin");
    await db.asService("update profiles set platform_role = 'admin' where id = $1", [temp]);
    await db.asService("insert into audit_log (actor_id, action) values ($1, 'settings.update')", [temp]);
    await db.asService("delete from auth.users where id = $1", [temp]);
    const row = await db.asService<{ actor_id: string | null }>(
      "select actor_id from audit_log where action = 'settings.update'",
    );
    expect(row.rows[0].actor_id).toBeNull();
  });
});

describe("Feedback inbox and settings (Part D4)", () => {
  it("Support and Admin can read all feedback and change its status; ordinary users cannot", async () => {
    await db.asService("insert into feedback (user_id, message, page) values ($1, 'Please add Tamil help', '/ta')", [ids.owner]);
    await db.asService("insert into feedback (message) values ('From a guest')");

    expect(await db.as(ids.admin, (s) => count(s, "select 1 from feedback"))).toBe(2);
    expect(await db.as(ids.support, (s) => count(s, "select 1 from feedback"))).toBe(2);
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from feedback"))).toBe(1); // only their own
    expect(await db.as(ids.other, (s) => count(s, "select 1 from feedback"))).toBe(0);

    expect(await db.as(ids.support, (s) => affected(s, "update feedback set status = 'in_progress' where message = 'From a guest'"))).toBe(1);
    expect(await db.as(ids.admin, (s) => affected(s, "update feedback set status = 'done' where message = 'From a guest'"))).toBe(1);
    expect(await db.as(ids.owner, (s) => affected(s, "update feedback set status = 'done' where message = 'Please add Tamil help'"))).toBe(0);
  });

  it("everyone can read the settings, only the Admin can change them", async () => {
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from app_settings"))).toBe(8);
    expect(await db.as(null, (s) => count(s, "select 1 from app_settings where key = 'maintenance'"))).toBe(1);

    const change = (who: string) =>
      db.as(who, (s) =>
        affected(s, `update app_settings set value = '{"on": true}', updated_by = $1 where key = 'maintenance'`, [who]),
      );
    expect(await change(ids.owner)).toBe(0);
    expect(await change(ids.support)).toBe(0);
    expect(await change(ids.admin)).toBe(1);
  });
});
