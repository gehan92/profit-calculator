import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase } from "./helpers/test-database";

/**
 * "Full delete for users" (Part F5 Privacy; Delete account in Part D2,
 * Delete user in Part D4) must work for every kind of user — also people
 * who wrote entries, invites, settings or audit rows.
 *
 * What happens to their rows:
 * - their own shop and everything in it is deleted;
 * - rows they wrote in someone else's shop stay (the shop owner's records),
 *   only the "written by" link is cleared;
 * - audit log rows stay (the admin's history), without the link.
 */

let db: TestDatabase;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asService<T>(sql, params);
  return rows[0];
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return (await one<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).n;
}

async function deleteUser(userId: string): Promise<void> {
  await db.asService("delete from auth.users where id = $1", [userId]);
}

beforeAll(async () => {
  db = await TestDatabase.create();
}, 60_000); // starting the in-memory Postgres can take a while on a busy machine

afterAll(async () => {
  await db.close();
});

describe("Deleting a user", () => {
  it("an Owner with entries, products and invites can be deleted; their shop goes too", async () => {
    const owner = await db.createUser("Owner who leaves");
    const shopId = await db.as(owner, async (s) => {
      const { rows } = await s.query<{ id: string }>(
        "insert into businesses (owner_id, name) values ($1, 'Leaving Stores') returning id",
        [owner],
      );
      const id = rows[0].id;
      await s.query(
        `insert into entries (business_id, type, category, amount_cents, entry_date, client_id)
         values ($1, 'income', 'sales', 250000, current_date, gen_random_uuid())`,
        [id],
      );
      await s.query(
        "insert into products (business_id, name, cost_cents, price_cents) values ($1, 'Soap', 8500, 11000)",
        [id],
      );
      await s.query("insert into invites (business_id, role) values ($1, 'staff')", [id]);
      return id;
    });

    await deleteUser(owner);

    expect(await count("select 1 from businesses where id = $1", [shopId])).toBe(0);
    expect(await count("select 1 from entries where business_id = $1", [shopId])).toBe(0);
    expect(await count("select 1 from invites where business_id = $1", [shopId])).toBe(0);
    expect(await count("select 1 from profiles where id = $1", [owner])).toBe(0);
  });

  it("a Staff member can be deleted; the entries they added stay in the owner's shop", async () => {
    const owner = await db.createUser("Kamala");
    const staff = await db.createUser("Nimal");
    const shopId = await db.as(owner, async (s) => {
      const { rows } = await s.query<{ id: string }>(
        "insert into businesses (owner_id, name) values ($1, 'Kamala Stores') returning id",
        [owner],
      );
      return rows[0].id;
    });
    await db.asService(
      "insert into business_members (business_id, user_id, role, invited_by) values ($1, $2, 'staff', $3)",
      [shopId, staff, owner],
    );
    await db.as(staff, (s) =>
      s.query(
        `insert into entries (business_id, type, category, amount_cents, entry_date)
         values ($1, 'income', 'sales', 120000, current_date)`,
        [shopId],
      ),
    );

    await deleteUser(staff);

    const entry = await one<{ created_by: string | null }>(
      "select created_by from entries where business_id = $1",
      [shopId],
    );
    expect(entry.created_by).toBeNull();
    expect(await count("select 1 from business_members where user_id = $1", [staff])).toBe(0);
  });

  it("an Owner who invited someone can be deleted while that person stays", async () => {
    const inviter = await db.createUser("Inviter");
    const invited = await db.createUser("Invited");
    const otherOwner = await db.createUser("Other owner");
    const shopId = await db.as(otherOwner, async (s) => {
      const { rows } = await s.query<{ id: string }>(
        "insert into businesses (owner_id, name) values ($1, 'Other Stores') returning id",
        [otherOwner],
      );
      return rows[0].id;
    });
    await db.asService(
      "insert into business_members (business_id, user_id, role, invited_by) values ($1, $2, 'viewer', $3)",
      [shopId, invited, inviter],
    );

    await deleteUser(inviter);

    const member = await one<{ invited_by: string | null }>(
      "select invited_by from business_members where user_id = $1",
      [invited],
    );
    expect(member.invited_by).toBeNull();
  });

  it("an admin can be deleted; their audit log rows and settings stay", async () => {
    const admin = await db.createUser("Former admin");
    await db.asService(
      "insert into audit_log (actor_id, action, target_user_id) values ($1, 'user.block', gen_random_uuid())",
      [admin],
    );
    await db.asService(
      "insert into app_settings (key, value, updated_by) values ('test_flag', 'true', $1)",
      [admin],
    );

    await deleteUser(admin);

    const audit = await one<{ actor_id: string | null }>(
      "select actor_id from audit_log where action = 'user.block'",
    );
    expect(audit.actor_id).toBeNull();
    const setting = await one<{ updated_by: string | null }>(
      "select updated_by from app_settings where key = 'test_flag'",
    );
    expect(setting.updated_by).toBeNull();
  });
});
