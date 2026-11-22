import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Day 12 database rules: the "Your account is paused" screen (Part C2), the
 * public Feedback form (Part D2) and the settings every visitor's page reads
 * (maintenance mode, Part C2). Part F5 testing checklist.
 */

const RLS_ERROR = /row-level security/;

let db: TestDatabase;
const ids = { owner: "", other: "", admin: "", shop: "" };

async function addIncome(s: Session, shopId: string): Promise<void> {
  await s.query(
    `insert into entries (business_id, type, category, amount_cents, entry_date)
     values ($1, 'income', 'sales', 100000, current_date)`,
    [shopId],
  );
}

beforeAll(async () => {
  db = await TestDatabase.create();
  ids.owner = await db.createUser("Kamala");
  ids.other = await db.createUser("Sunil");
  ids.admin = await db.createUser("Gehan");
  await db.asService("update profiles set platform_role = 'admin' where id = $1", [ids.admin]);

  ids.shop = await db.as(ids.owner, async (s) => {
    const { rows } = await s.query<{ id: string }>(
      "insert into businesses (owner_id, name) values ($1, 'Kamala Stores') returning id",
      [ids.owner],
    );
    return rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("A paused (blocked) account", () => {
  it("can add records while active", async () => {
    await db.as(ids.owner, (s) => addIncome(s, ids.shop));
  });

  it("can still read its own status, which is how the paused screen knows", async () => {
    await db.asService("update profiles set status = 'blocked' where id = $1", [ids.owner]);
    const status = await db.as(ids.owner, async (s) => {
      const { rows } = await s.query<{ status: string }>("select status from profiles where id = $1", [ids.owner]);
      return rows[0]?.status;
    });
    expect(status).toBe("blocked");
  });

  it("can no longer add records, even to its own shop", async () => {
    await expect(db.as(ids.owner, (s) => addIncome(s, ids.shop))).rejects.toThrow(RLS_ERROR);
  });

  it("cannot unblock itself", async () => {
    await expect(
      db.as(ids.owner, (s) => s.query("update profiles set status = 'active' where id = $1", [ids.owner])),
    ).rejects.toThrow(/permission denied/);
  });

  it("adds records again as soon as an Admin lets it back in", async () => {
    await db.asService("update profiles set status = 'active' where id = $1", [ids.owner]);
    await db.as(ids.owner, (s) => addIncome(s, ids.shop));
  });

  it("a blocked Admin loses the Admin powers at once", async () => {
    await db.asService("update profiles set status = 'blocked' where id = $1", [ids.admin]);
    await expect(db.as(ids.admin, (s) => s.query("select admin_stats()"))).rejects.toThrow(/forbidden/);
    await db.asService("update profiles set status = 'active' where id = $1", [ids.admin]);
  });
});

describe("Feedback form (Part D2: open to everyone)", () => {
  it("a guest can send a message with a contact and the page it came from", async () => {
    await db.as(null, (s) =>
      s.query("insert into feedback (message, contact, page) values ('Add a VAT calculator', '0771234567', '/en/home')"),
    );
  });

  it("a guest cannot put someone else's id on a message", async () => {
    await expect(
      db.as(null, (s) => s.query("insert into feedback (user_id, message) values ($1, 'hello')", [ids.owner])),
    ).rejects.toThrow(RLS_ERROR);
  });

  it("a logged-in person can send in their own name", async () => {
    await db.as(ids.owner, (s) =>
      s.query("insert into feedback (user_id, message) values ($1, 'Please add Tamil help')", [ids.owner]),
    );
  });

  it("a logged-in person cannot send in another person's name", async () => {
    await expect(
      db.as(ids.owner, (s) => s.query("insert into feedback (user_id, message) values ($1, 'fake')", [ids.other])),
    ).rejects.toThrow(RLS_ERROR);
  });

  it("an empty or over-long message is refused by the database itself", async () => {
    await expect(db.as(null, (s) => s.query("insert into feedback (message) values ('')"))).rejects.toThrow();
    await expect(
      db.as(null, (s) => s.query("insert into feedback (message) values ($1)", ["x".repeat(2001)])),
    ).rejects.toThrow();
  });

  it("a sender reads only their own messages; the team reads all", async () => {
    const own = await db.as(ids.owner, async (s) => {
      const { rows } = await s.query("select 1 from feedback");
      return rows.length;
    });
    const other = await db.as(ids.other, async (s) => {
      const { rows } = await s.query("select 1 from feedback");
      return rows.length;
    });
    const team = await db.as(ids.admin, async (s) => {
      const { rows } = await s.query("select 1 from feedback");
      return rows.length;
    });
    expect(own).toBe(1);
    expect(other).toBe(0);
    expect(team).toBe(2);
  });
});

describe("Settings every visitor's page reads (maintenance mode)", () => {
  it("a guest can read the settings with only the public key", async () => {
    const maintenance = await db.as(null, async (s) => {
      const { rows } = await s.query<{ value: { on: boolean } }>("select value from app_settings where key = 'maintenance'");
      return rows[0]?.value;
    });
    expect(maintenance).toEqual({ on: false });
  });

  it("a guest cannot change them", async () => {
    const changed = await db.as(null, async (s) => {
      const result = await s.query("update app_settings set value = '{\"on\": true}' where key = 'maintenance'");
      return result.affectedRows ?? 0;
    });
    expect(changed).toBe(0);
  });

  it("an ordinary shop owner cannot change them either", async () => {
    const changed = await db.as(ids.owner, async (s) => {
      const result = await s.query("update app_settings set value = '{\"on\": true}' where key = 'maintenance'");
      return result.affectedRows ?? 0;
    });
    expect(changed).toBe(0);
  });

  it("the Admin can switch maintenance on and off", async () => {
    const on = await db.as(ids.admin, async (s) => {
      const result = await s.query("update app_settings set value = '{\"on\": true}' where key = 'maintenance'");
      return result.affectedRows ?? 0;
    });
    expect(on).toBe(1);
    const seen = await db.as(null, async (s) => {
      const { rows } = await s.query<{ value: { on: boolean } }>("select value from app_settings where key = 'maintenance'");
      return rows[0]?.value;
    });
    expect(seen).toEqual({ on: true });
    await db.as(ids.admin, (s) => s.query("update app_settings set value = '{\"on\": false}' where key = 'maintenance'"));
  });
});
