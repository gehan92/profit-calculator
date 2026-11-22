import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Admin panel database rules (Part D4, Part B3, migration 0003):
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
  full_name: string | null;
  email: string | null;
  phone: string | null;
  platform_role: string;
  status: string;
  plan: string;
  entries_count: number;
  total_count: number;
};

const listUsers = (userId: string | null, search: string | null, limit = 25, offset = 0) =>
  db.as(userId, async (s) => {
    const { rows } = await s.query<UserRow>("select * from admin_users($1, $2, $3)", [search, limit, offset]);
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
  await db.asService("update businesses set plan = 'pro' where id = $1", [ids.otherShop]);

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

describe("admin_users()", () => {
  it("lists everyone for the Admin: contact, plan, status and the number of entries", async () => {
    const rows = await listUsers(ids.admin, null);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.total_count === 5)).toBe(true);

    const kamala = rows.find((row) => row.user_id === ids.owner)!;
    expect(kamala).toMatchObject({
      full_name: "Kamala Perera",
      email: "kamala@example.com",
      phone: "+94771234567",
      platform_role: "user",
      status: "active",
      plan: "free",
      entries_count: 3,
    });
    expect(rows.find((row) => row.user_id === ids.other)?.plan).toBe("pro");
    expect(rows.find((row) => row.user_id === ids.blocked)?.status).toBe("blocked");
  });

  it("is open to Support too (Part D4: Users — Support, Admin)", async () => {
    expect(await listUsers(ids.support, null)).toHaveLength(5);
  });

  it("returns no amounts, notes or categories: only account info and a count", async () => {
    const rows = await listUsers(ids.admin, "kamala");
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "created_at", "email", "entries_count", "full_name", "last_active_at", "phone",
        "plan", "platform_role", "status", "total_count", "user_id",
      ].sort(),
    );
  });

  it("finds a user by part of the email, phone or name, in any letter case", async () => {
    expect((await listUsers(ids.admin, "SHOP.LK")).map((row) => row.user_id)).toEqual([ids.other]);
    expect((await listUsers(ids.admin, "771234")).map((row) => row.user_id)).toEqual([ids.owner]);
    expect((await listUsers(ids.admin, "perera")).map((row) => row.user_id)).toEqual([ids.owner]);
    expect((await listUsers(ids.admin, "  kamala  ")).map((row) => row.user_id)).toEqual([ids.owner]);
    expect(await listUsers(ids.admin, "nobody-has-this")).toEqual([]);
  });

  it("treats % and _ as plain letters, not as wildcards", async () => {
    expect(await listUsers(ids.admin, "%")).toEqual([]);
    expect(await listUsers(ids.admin, "k_mala")).toEqual([]);
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
});

describe("admin_user_detail()", () => {
  const detail = (userId: string | null, target: string) =>
    db.as(userId, async (s) => {
      const { rows } = await s.query<{ detail: Record<string, unknown> | null }>(
        "select admin_user_detail($1) as detail",
        [target],
      );
      return rows[0].detail;
    });

  it("shows account info, support-access status and each shop with the role and a count", async () => {
    const result = await detail(ids.admin, ids.owner);
    expect(result).toMatchObject({
      id: ids.owner,
      full_name: "Kamala Perera",
      email: "kamala@example.com",
      phone: "+94771234567",
      status: "active",
      platform_role: "user",
      support_access_until: null,
      shops: [{ id: ids.shop, name: "Kamala Stores", plan: "free", role: "owner", entries_count: 3 }],
    });
  });

  it("is open to Support and shows nothing about money", async () => {
    const result = await detail(ids.support, ids.owner);
    expect(JSON.stringify(result)).not.toMatch(/amount|cents|note|category|2500000/);
  });

  it("returns null for an unknown user and refuses ordinary users", async () => {
    expect(await detail(ids.admin, "00000000-0000-0000-0000-000000000000")).toBeNull();
    await expect(detail(ids.owner, ids.other)).rejects.toThrow(/forbidden/);
    await expect(detail(null, ids.owner)).rejects.toThrow(/permission denied/);
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
    expect(await db.as(ids.admin, (s) => count(s, "select 1 from audit_log"))).toBe(1);
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
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from app_settings"))).toBe(5);
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
