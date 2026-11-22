import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { AdminQueryError, AdminRepository } from "./admin-repository";

type Answer = { data?: unknown; error?: { message: string } | null; count?: number | null };

/** A fake Supabase client: `rpc` and table queries answer with `answer`, and every call is remembered. */
function fakeDb(answer: Answer | ((call: number) => Answer) = { data: [] }) {
  const calls: { method: string; args: unknown[] }[] = [];
  let number = 0;
  const next = () => {
    const value = typeof answer === "function" ? answer(++number) : answer;
    return { data: null, error: null, count: null, ...value };
  };

  const chain: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => Promise.resolve(next()).then(resolve) };
  for (const method of ["select", "eq", "order", "range", "update", "upsert"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  const db = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ method: `rpc:${name}`, args: [args] });
      return next();
    },
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
  return { db, calls };
}

describe("AdminRepository.stats", () => {
  it("renames the database keys and keeps the language split", async () => {
    const { db } = fakeDb({
      data: {
        users_total: 12, signups_today: 2, signups_7d: 5, signups_30d: 9, weekly_active: 4,
        entries_today: 30, businesses_total: 11, pro_businesses: 1, blocked_users: 0, feedback_new: 3,
        language_split: { en: 4, si: 7 },
      },
    });
    expect(await new AdminRepository(db).stats()).toEqual({
      usersTotal: 12, signupsToday: 2, signups7d: 5, signups30d: 9, weeklyActive: 4,
      entriesToday: 30, businessesTotal: 11, proBusinesses: 1, blockedUsers: 0, feedbackNew: 3,
      languageSplit: { en: 4, si: 7 },
    });
  });

  it("refuses an answer that does not have the expected shape, and reports 'forbidden'", async () => {
    await expect(new AdminRepository(fakeDb({ data: { users_total: "many" } }).db).stats()).rejects.toThrow();
    await expect(new AdminRepository(fakeDb({ error: { message: "forbidden" } }).db).stats()).rejects.toBeInstanceOf(AdminQueryError);
  });
});

describe("AdminRepository.listUsers", () => {
  const row = (id: string, total: number) => ({
    user_id: id, full_name: "Kamala", email: "k@example.com", phone: null, created_at: "2026-11-01T00:00:00Z",
    last_active_at: null, platform_role: "user", status: "active", plan: "free", entries_count: 3, total_count: total,
  });

  it("maps the rows and takes the total from the first one", async () => {
    const { db, calls } = fakeDb({ data: [row("a", 41), row("b", 41)] });
    const page = await new AdminRepository(db).listUsers({ search: "kam", page: 2, pageSize: 25 });

    expect(page.total).toBe(41);
    expect(page.users[0]).toMatchObject({ id: "a", fullName: "Kamala", email: "k@example.com", plan: "free", entriesCount: 3 });
    expect(calls[0]).toEqual({ method: "rpc:admin_users", args: [{ p_search: "kam", p_limit: 25, p_offset: 25 }] });
  });

  it("has a total of 0 for an empty page", async () => {
    expect((await new AdminRepository(fakeDb({ data: [] }).db).listUsers()).total).toBe(0);
  });
});

describe("AdminRepository.userDetail", () => {
  it("maps one user with their shops", async () => {
    const { db } = fakeDb({
      data: {
        id: "u1", full_name: "Kamala", email: "k@example.com", phone: null, created_at: "2026-11-01T00:00:00Z",
        last_active_at: null, platform_role: "user", status: "active", support_access_until: null,
        shops: [{ id: "s1", name: "Kamala Stores", plan: "free", role: "owner", entries_count: 142 }],
      },
    });
    const detail = await new AdminRepository(db).userDetail("u1");
    expect(detail?.shops).toEqual([{ id: "s1", name: "Kamala Stores", plan: "free", role: "owner", entriesCount: 142 }]);
    expect(detail?.supportAccessUntil).toBeNull();
  });

  it("is null for an unknown user", async () => {
    expect(await new AdminRepository(fakeDb({ data: null }).db).userDetail("x")).toBeNull();
  });
});

describe("AdminRepository feedback, audit and settings", () => {
  it("lists one page of feedback, filtered by status, with the total", async () => {
    const { db, calls } = fakeDb({
      count: 3,
      data: [{ id: "f1", user_id: null, message: "Hello", contact: "0771234567", page: "/ta", status: "in_progress", created_at: "2026-11-02T00:00:00Z" }],
    });
    const result = await new AdminRepository(db).listFeedback({ status: "in_progress", page: 2, pageSize: 10 });
    expect(result.total).toBe(3);
    expect(result.rows[0]).toMatchObject({ id: "f1", status: "in_progress", contact: "0771234567" });
    expect(calls).toContainEqual({ method: "eq", args: ["status", "in_progress"] });
    expect(calls).toContainEqual({ method: "range", args: [10, 19] });
  });

  it("treats an unknown stored status as new", async () => {
    const { db } = fakeDb({ data: [{ id: "f1", user_id: null, message: "x", contact: null, page: null, status: "weird", created_at: "2026-11-02T00:00:00Z" }] });
    expect((await new AdminRepository(db).listFeedback()).rows[0].status).toBe("new");
  });

  it("says whether a feedback status really changed", async () => {
    expect(await new AdminRepository(fakeDb({ data: [{ id: "f1" }] }).db).updateFeedbackStatus("f1", "done")).toBe(true);
    expect(await new AdminRepository(fakeDb({ data: [] }).db).updateFeedbackStatus("f1", "done")).toBe(false);
  });

  it("lists the audit log newest first, filtered by action and user", async () => {
    const { db, calls } = fakeDb({
      count: 1,
      data: [{ id: 7, actor_id: "a1", action: "user.block", target_user_id: "u1", details: { email: "k@example.com" }, created_at: "2026-11-02T00:00:00Z" }],
    });
    const result = await new AdminRepository(db).listAudit({ action: "user.block", targetUserId: "u1" });
    expect(result.rows[0]).toMatchObject({ id: 7, action: "user.block", details: { email: "k@example.com" } });
    expect(calls).toContainEqual({ method: "eq", args: ["action", "user.block"] });
    expect(calls).toContainEqual({ method: "eq", args: ["target_user_id", "u1"] });
    expect(calls).toContainEqual({ method: "order", args: ["id", { ascending: false }] });
  });

  it("reads the settings with defaults for what is missing", async () => {
    const { db } = fakeDb({ data: [{ key: "maintenance", value: { on: true } }] });
    const settings = await new AdminRepository(db).settings();
    expect(settings.maintenance).toEqual({ on: true });
    expect(settings.pro_limits).toEqual({ staff: 3, viewers: 2 });
  });

  it("refuses to pretend a setting was saved when no row changed (not an Admin)", async () => {
    await expect(new AdminRepository(fakeDb({ data: [] }).db).saveSetting("maintenance", { on: true }, "a1")).rejects.toThrow(AdminQueryError);
    await expect(new AdminRepository(fakeDb({ data: [{ key: "maintenance" }] }).db).saveSetting("maintenance", { on: true }, "a1")).resolves.toBeUndefined();
  });
});
