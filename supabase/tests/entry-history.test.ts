import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Entry history (Part E5 "Never lose work", migration 0006): every change and
 * delete is kept so the owner can undo a mistake; only the owner can read or
 * restore it; a deleted shop takes its history with it; old history is cleaned.
 */

let db: TestDatabase;
const ids = { owner: "", staff: "", viewer: "", other: "", shop: "", otherShop: "" };

async function count(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await s.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return rows[0].n;
}

async function addEntry(amount: number, note: string | null = null): Promise<string> {
  const { rows } = await db.asService<{ id: string }>(
    `insert into entries (business_id, type, category, amount_cents, entry_date, note, created_by)
     values ($1, 'income', 'sales', $2, current_date, $3, $4) returning id`,
    [ids.shop, amount, note, ids.owner],
  );
  return rows[0].id;
}

const historyOf = (entry: string) =>
  db.asService<{ id: string; action: string; old_row: { amount_cents: number } }>(
    "select id::text, action, old_row from entry_history where entry_id = $1 order by id",
    [entry],
  ).then((result) => result.rows);

beforeAll(async () => {
  db = await TestDatabase.create();
  ids.owner = await db.createUser("Owner");
  ids.staff = await db.createUser("Staff");
  ids.viewer = await db.createUser("Viewer");
  ids.other = await db.createUser("Other Owner");

  const shop = (owner: string, name: string) =>
    db.as(owner, async (s) => (await s.query<{ id: string }>("insert into businesses (owner_id, name) values ($1, $2) returning id", [owner, name])).rows[0].id);
  ids.shop = await shop(ids.owner, "Main Shop");
  ids.otherShop = await shop(ids.other, "Other Shop");
  await db.asService("insert into business_members (business_id, user_id, role) values ($1, $2, 'staff'), ($1, $3, 'viewer')", [ids.shop, ids.staff, ids.viewer]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Every change and delete is kept", () => {
  it("a new entry has no history yet", async () => {
    const entry = await addEntry(10_000);
    expect(await historyOf(entry)).toEqual([]);
  });

  it("a change keeps the old values, a delete keeps the whole old row", async () => {
    const entry = await addEntry(20_000, "first");
    await db.as(ids.owner, (s) => s.query("update entries set amount_cents = 250000 where id = $1", [entry]));
    await db.as(ids.owner, (s) => s.query("delete from entries where id = $1", [entry]));
    const rows = await historyOf(entry);
    expect(rows.map((row) => row.action)).toEqual(["update", "delete"]);
    expect(rows[0].old_row.amount_cents).toBe(20_000);
    expect(rows[1].old_row.amount_cents).toBe(250_000);
  });

  it("records who did it", async () => {
    const entry = await addEntry(1_000);
    await db.as(ids.owner, (s) => s.query("update entries set note = 'x' where id = $1", [entry]));
    const { rows } = await db.asService<{ changed_by: string }>("select changed_by from entry_history where entry_id = $1", [entry]);
    expect(rows[0].changed_by).toBe(ids.owner);
  });
});

describe("Only the owner can read and use the history", () => {
  it("the owner reads it; staff, viewer and another shop's owner read nothing", async () => {
    expect(await db.as(ids.owner, (s) => count(s, "select 1 from entry_history"))).toBeGreaterThan(0);
    for (const who of [ids.staff, ids.viewer, ids.other]) {
      expect(await db.as(who, (s) => count(s, "select 1 from entry_history"))).toBe(0);
    }
  });

  it("nobody can write or erase history with a normal login", async () => {
    await expect(
      db.as(ids.owner, (s) => s.query("insert into entry_history (entry_id, business_id, action, old_row) values (gen_random_uuid(), $1, 'delete', '{}')", [ids.shop])),
    ).rejects.toThrow(/row-level security|permission/);
    expect((await db.as(ids.owner, (s) => s.query("delete from entry_history"))).affectedRows).toBe(0);
    expect((await db.as(ids.owner, (s) => s.query("update entry_history set action = 'update'"))).affectedRows).toBe(0);
  });
});

describe("Undo (restore_entry_from_history)", () => {
  it("brings back a deleted entry exactly as it was", async () => {
    const entry = await addEntry(777_00, "keep me");
    await db.as(ids.owner, (s) => s.query("delete from entries where id = $1", [entry]));
    const [deleted] = await historyOf(entry);
    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [deleted.id]));
    const { rows } = await db.asService<{ amount_cents: string; note: string; created_by: string }>("select amount_cents::text, note, created_by from entries where id = $1", [entry]);
    expect(rows).toEqual([{ amount_cents: "77700", note: "keep me", created_by: ids.owner }]);
  });

  it("puts back the values before a change", async () => {
    const entry = await addEntry(5_000, "before");
    await db.as(ids.owner, (s) => s.query("update entries set amount_cents = 9000, note = 'after' where id = $1", [entry]));
    const [change] = await historyOf(entry);
    await db.as(ids.owner, (s) => s.query("select restore_entry_from_history($1)", [change.id]));
    const { rows } = await db.asService<{ amount_cents: string; note: string }>("select amount_cents::text, note from entries where id = $1", [entry]);
    expect(rows).toEqual([{ amount_cents: "5000", note: "before" }]);
  });

  it("is only for the shop's owner", async () => {
    const entry = await addEntry(3_000);
    await db.as(ids.owner, (s) => s.query("delete from entries where id = $1", [entry]));
    const [deleted] = await historyOf(entry);
    for (const who of [ids.staff, ids.viewer, ids.other]) {
      await expect(db.as(who, (s) => s.query("select restore_entry_from_history($1)", [deleted.id]))).rejects.toThrow(/not_allowed/);
    }
    await expect(db.as(null, (s) => s.query("select restore_entry_from_history($1)", [deleted.id]))).rejects.toThrow(/permission denied/);
  });
});

describe("Cleanup and shop deletion", () => {
  it("the daily job removes history older than 30 days (1 year for Pro shops)", async () => {
    const freeEntry = await addEntry(100);
    const proEntry = await db.asService<{ id: string }>(
      `insert into entries (business_id, type, category, amount_cents, entry_date, created_by)
       values ($1, 'income', 'sales', 100, current_date, $2) returning id`,
      [ids.otherShop, ids.other],
    ).then((result) => result.rows[0].id);
    await db.asService(
      `insert into subscriptions (user_id, plan_code, gateway, status, currency, current_period_end)
       values ($1, 'pro_yearly', 'paddle', 'active', 'USD', now() + interval '300 days')`,
      [ids.other],
    );
    await db.asService("delete from entries where id in ($1, $2)", [freeEntry, proEntry]);
    await db.asService("update entry_history set changed_at = now() - interval '40 days' where entry_id in ($1, $2)", [freeEntry, proEntry]);

    await db.asService("select purge_old_entry_history()");
    expect(await historyOf(freeEntry)).toEqual([]);
    expect(await historyOf(proEntry)).toHaveLength(1);

    await db.asService("update entry_history set changed_at = now() - interval '400 days' where entry_id = $1", [proEntry]);
    await db.asService("select purge_old_entry_history()");
    expect(await historyOf(proEntry)).toEqual([]);
  });

  it("nobody but server code can run the cleanup", async () => {
    await expect(db.as(ids.owner, (s) => s.query("select purge_old_entry_history()"))).rejects.toThrow(/permission denied/);
  });

  it("deleting a shop (or the whole account) deletes its history too", async () => {
    const entry = await addEntry(4_000);
    await db.asService("update entries set amount_cents = 4100 where id = $1", [entry]);
    expect((await historyOf(entry)).length).toBeGreaterThan(0);
    await db.asService("delete from auth.users where id = $1", [ids.owner]);
    const { rows } = await db.asService<{ n: number }>("select count(*)::int as n from entry_history where business_id = $1", [ids.shop]);
    expect(rows[0].n).toBe(0);
    expect((await db.asService<{ n: number }>("select count(*)::int as n from entries where business_id = $1", [ids.shop])).rows[0].n).toBe(0);
  });
});
