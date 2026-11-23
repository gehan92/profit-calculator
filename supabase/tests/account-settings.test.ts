import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase } from "./helpers/test-database";

/**
 * The Account page's database part (spec D6, migration 0011): a person's own
 * settings, their own signed-in devices, and their profile photo.
 */

let db: TestDatabase;
const ids = { ann: "", ben: "" };

/** Each test file starts from a database with the real migrations applied. */
beforeAll(async () => {
  db = await TestDatabase.create();
  ids.ann = await db.createUser("Ann");
  ids.ben = await db.createUser("Ben");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Account settings on the profile", () => {
  it("start with safe defaults for people who already had a profile", async () => {
    const { rows } = await db.asService<{
      date_format: string;
      default_currency: string | null;
      notify_daily: boolean;
      notify_daily_time: string;
      notify_weekly: boolean;
      notify_payments: boolean;
    }>(
      "select date_format, default_currency, notify_daily, notify_daily_time::text, notify_weekly, notify_payments from profiles where id = $1",
      [ids.ann],
    );
    expect(rows[0]).toEqual({
      date_format: "ymd",
      default_currency: null,
      notify_daily: false,
      notify_daily_time: "20:00:00",
      notify_weekly: false,
      notify_payments: true,
    });
  });

  it("a person can change their own settings", async () => {
    await db.as(ids.ann, async (s) => {
      const { rows } = await s.query<{ id: string }>(
        `update profiles
            set date_format = 'dmy', default_currency = 'INR', notify_daily = true,
                notify_daily_time = '07:30', notify_weekly = true, notify_payments = false
          where id = $1 returning id`,
        [ids.ann],
      );
      expect(rows).toHaveLength(1);
    });
    const { rows } = await db.asService<{ date_format: string; default_currency: string; notify_daily_time: string }>(
      "select date_format, default_currency, notify_daily_time::text from profiles where id = $1",
      [ids.ann],
    );
    expect(rows[0]).toEqual({ date_format: "dmy", default_currency: "INR", notify_daily_time: "07:30:00" });
  });

  it("refuses a date format or currency we do not support", async () => {
    await expect(
      db.as(ids.ann, (s) => s.query("update profiles set date_format = 'banana' where id = $1", [ids.ann])),
    ).rejects.toThrow(/date_format|check/i);
    await expect(
      db.as(ids.ann, (s) => s.query("update profiles set default_currency = 'XXX' where id = $1", [ids.ann])),
    ).rejects.toThrow(/default_currency|check/i);
  });

  it("a person still cannot change their own role or status", async () => {
    await expect(
      db.as(ids.ann, (s) => s.query("update profiles set platform_role = 'admin' where id = $1", [ids.ann])),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.as(ids.ann, (s) => s.query("update profiles set status = 'active' where id = $1", [ids.ann])),
    ).rejects.toThrow(/permission denied/i);
  });

  it("a person cannot change someone else's settings (no row is changed)", async () => {
    await db.as(ids.ann, async (s) => {
      const { rows } = await s.query("update profiles set date_format = 'mdy' where id = $1 returning id", [ids.ben]);
      expect(rows).toHaveLength(0);
    });
    const { rows } = await db.asService<{ date_format: string }>("select date_format from profiles where id = $1", [ids.ben]);
    expect(rows[0].date_format).toBe("ymd");
  });
});

describe("my_sessions(): my signed-in devices", () => {
  const sessions = { annPhone: "", annLaptop: "", annOld: "", benPhone: "" };

  beforeAll(async () => {
    const add = async (user: string, agent: string, extra = "") =>
      (
        await db.asService<{ id: string }>(
          `insert into auth.sessions (id, user_id, user_agent, ip, created_at, refreshed_at ${extra ? ", not_after" : ""})
           values (gen_random_uuid(), $1, $2, '203.0.113.9', now() - interval '3 days', now() - interval '1 hour' ${extra ? `, ${extra}` : ""})
           returning id`,
          [user, agent],
        )
      ).rows[0].id;
    sessions.annPhone = await add(ids.ann, "Chrome on Android");
    sessions.annLaptop = await add(ids.ann, "Edge on Windows");
    sessions.annOld = await add(ids.ann, "Firefox on Linux", "now() - interval '1 day'");
    sessions.benPhone = await add(ids.ben, "Safari on iPhone");
  });

  it("lists only my own devices that are still signed in, newest use first", async () => {
    await db.asService("update auth.sessions set refreshed_at = now() - interval '5 minutes' where id = $1", [sessions.annLaptop]);
    await db.as(ids.ann, async (s) => {
      const { rows } = await s.query<{ session_id: string; user_agent: string }>("select session_id, user_agent from my_sessions()");
      expect(rows.map((row) => row.user_agent)).toEqual(["Edge on Windows", "Chrome on Android"]);
      expect(rows.some((row) => row.session_id === sessions.benPhone)).toBe(false);
      expect(rows.some((row) => row.session_id === sessions.annOld)).toBe(false);
    });
  });

  it("marks the device I am using right now", async () => {
    await db.as(ids.ann, async (s) => {
      await s.query("select set_config('request.jwt.claim.session_id', $1, true)", [sessions.annPhone]);
      const { rows } = await s.query<{ user_agent: string; is_current: boolean }>("select user_agent, is_current from my_sessions() order by user_agent");
      expect(rows).toEqual([
        { user_agent: "Chrome on Android", is_current: true },
        { user_agent: "Edge on Windows", is_current: false },
      ]);
    });
  });

  it("never returns a network address", async () => {
    await db.as(ids.ann, async (s) => {
      const { fields } = await s.query("select * from my_sessions()");
      expect(fields.map((field) => field.name).sort()).toEqual(["created_at", "is_current", "last_seen_at", "session_id", "user_agent"]);
    });
  });

  it("is not available to a guest", async () => {
    await expect(db.as(null, (s) => s.query("select * from my_sessions()"))).rejects.toThrow(/permission denied/i);
  });
});

describe("Profile photo (Storage bucket 'avatars')", () => {
  it("is a small-image bucket", async () => {
    const { rows } = await db.asService<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select public, file_size_limit::text, allowed_mime_types from storage.buckets where id = 'avatars'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].file_size_limit).toBe("524288");
    expect(rows[0].allowed_mime_types).toEqual(["image/webp", "image/jpeg", "image/png"]);
  });

  it("a person can add, replace and remove files in their own folder", async () => {
    const name = `${ids.ann}/first.webp`;
    await db.as(ids.ann, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [name, ids.ann]);
      const updated = await s.query("update storage.objects set name = $2 where bucket_id = 'avatars' and name = $1 returning id", [name, `${ids.ann}/second.webp`]);
      expect(updated.rows).toHaveLength(1);
      const removed = await s.query("delete from storage.objects where bucket_id = 'avatars' and name = $1 returning id", [`${ids.ann}/second.webp`]);
      expect(removed.rows).toHaveLength(1);
    });
  });

  it("a person cannot put a file in someone else's folder", async () => {
    await expect(
      db.as(ids.ann, (s) => s.query("insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [`${ids.ben}/hack.webp`, ids.ann])),
    ).rejects.toThrow(/row-level security/i);
  });

  it("a person cannot replace or delete someone else's file", async () => {
    const bens = `${ids.ben}/mine.webp`;
    await db.asService("insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [bens, ids.ben]);
    await db.as(ids.ann, async (s) => {
      const changed = await s.query("update storage.objects set name = $2 where bucket_id = 'avatars' and name = $1 returning id", [bens, `${ids.ann}/stolen.webp`]);
      expect(changed.rows).toHaveLength(0);
      const removed = await s.query("delete from storage.objects where bucket_id = 'avatars' and name = $1 returning id", [bens]);
      expect(removed.rows).toHaveLength(0);
    });
    const { rows } = await db.asService("select 1 from storage.objects where name = $1", [bens]);
    expect(rows).toHaveLength(1);
  });

  it("a guest cannot upload at all", async () => {
    await expect(
      db.as(null, (s) => s.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${ids.ann}/guest.webp`])),
    ).rejects.toThrow(/row-level security|permission denied/i);
  });

  it("a person can list only their own photos, never other people's (addresses stay private)", async () => {
    await db.asService("insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [`${ids.ben}/listed.webp`, ids.ben]);
    await db.asService("insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [`${ids.ann}/listed.webp`, ids.ann]);
    await db.as(ids.ann, async (s) => {
      const { rows } = await s.query<{ name: string }>("select name from storage.objects where bucket_id = 'avatars'");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.name.startsWith(`${ids.ann}/`))).toBe(true);
    });
    await db.as(null, async (s) => {
      const { rows } = await s.query("select name from storage.objects where bucket_id = 'avatars'");
      expect(rows).toHaveLength(0);
    });
  });
});
