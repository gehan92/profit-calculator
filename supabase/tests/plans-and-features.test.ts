import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, type Session } from "./helpers/test-database";

/**
 * Plans and payments (Part D5, migration 0004) and feature switches (Part D7,
 * migration 0006): who is on Pro, who may read what, and the switch rules that
 * the database enforces on its own (core features always on, free forever
 * can't be taken back, Off beats everything).
 */

let db: TestDatabase;
const ids = { admin: "", free: "", pro: "", trial: "", expired: "", business: "", other: "" };

async function count(s: Session, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await s.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return rows[0].n;
}

async function subscribe(user: string, plan: string, status: string, periodEnd: string | null, gateway = "paddle") {
  await db.asService(
    `insert into subscriptions (user_id, plan_code, gateway, gateway_subscription_id, status, currency, current_period_end)
     values ($1, $2, $3, $4, $5, 'USD', ${periodEnd ? `now() + interval '${periodEnd}'` : "null"})`,
    [user, plan, gateway, `sub_${user}_${plan}_${status}`, status],
  );
}

const tier = (user: string) =>
  db.as(user, async (s) => (await s.query<{ t: string }>("select user_tier() as t")).rows[0].t);
const enabled = (user: string | null, key: string) =>
  db.as(user, async (s) => (await s.query<{ e: boolean }>("select feature_enabled($1) as e", [key])).rows[0].e);

beforeAll(async () => {
  db = await TestDatabase.create();
  ids.admin = await db.createUser("Admin");
  ids.free = await db.createUser("Free User");
  ids.pro = await db.createUser("Pro User");
  ids.trial = await db.createUser("Trial User");
  ids.expired = await db.createUser("Expired User");
  ids.business = await db.createUser("Business User");
  ids.other = await db.createUser("Other User");
  await db.asService("update profiles set platform_role = 'admin' where id = $1", [ids.admin]);

  await subscribe(ids.pro, "pro_monthly", "active", "20 days");
  await subscribe(ids.trial, "pro_monthly", "trialing", "10 days", "manual");
  await subscribe(ids.expired, "pro_pass_1m", "active", null);
  await db.asService("update subscriptions set current_period_end = now() - interval '1 day' where user_id = $1", [ids.expired]);
  await subscribe(ids.business, "business_monthly", "active", "20 days");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Which plan is a user on? (user_tier / is_pro)", () => {
  it("Free by default, Pro with an active subscription or a trial, Business includes Pro", async () => {
    expect(await tier(ids.free)).toBe("free");
    expect(await tier(ids.pro)).toBe("pro");
    expect(await tier(ids.trial)).toBe("pro");
    expect(await tier(ids.business)).toBe("business");
    const isPro = (u: string) => db.as(u, async (s) => (await s.query<{ p: boolean }>("select is_pro() as p")).rows[0].p);
    expect([await isPro(ids.free), await isPro(ids.pro), await isPro(ids.business)]).toEqual([false, true, true]);
  });

  it("an expired pass returns the user to Free, a past-due subscription keeps Pro until the period ends", async () => {
    expect(await tier(ids.expired)).toBe("free");
    await db.asService("update subscriptions set status = 'past_due' where user_id = $1", [ids.pro]);
    expect(await tier(ids.pro)).toBe("pro");
    await db.asService("update subscriptions set status = 'cancelled' where user_id = $1", [ids.pro]);
    expect(await tier(ids.pro)).toBe("free");
    await db.asService("update subscriptions set status = 'active' where user_id = $1", [ids.pro]);
  });

  it("each user gets one free trial, ever", async () => {
    await expect(
      db.asService(
        `insert into subscriptions (user_id, plan_code, gateway, status, currency) values ($1, 'pro_monthly', 'manual', 'trialing', 'LKR')`,
        [ids.trial],
      ),
    ).rejects.toThrow(/one_trial_per_user|duplicate/);
  });
});

describe("Founding spots and which plans can be bought", () => {
  it("a founding plan with spots left, a normal plan and a pass can be bought", async () => {
    const ok = async (code: string) =>
      (await db.asService<{ a: boolean }>("select plan_available($1) as a", [code])).rows[0].a;
    expect(await ok("pro_founding_monthly")).toBe(true);
    expect(await ok("pro_monthly")).toBe(true);
    expect(await ok("pro_pass_12m")).toBe(true);
  });

  it("the free plan, hidden Business plans and unknown plans cannot be bought", async () => {
    const ok = async (code: string) =>
      (await db.asService<{ a: boolean }>("select plan_available($1) as a", [code])).rows[0].a;
    expect(await ok("free")).toBe(false);
    expect(await ok("business_monthly")).toBe(false);
    expect(await ok("nope")).toBe(false);
  });

  it("founding spots are shared by all founding plans and close when they run out", async () => {
    await db.asService("update plans set max_subscribers = 1 where is_founding");
    expect((await db.asService<{ n: number }>("select plan_spots_left('pro_founding_yearly') as n")).rows[0].n).toBe(1);
    await subscribe(ids.other, "pro_founding_yearly", "active", "300 days");
    expect((await db.asService<{ n: number }>("select plan_spots_left('pro_founding_monthly') as n")).rows[0].n).toBe(0);
    expect((await db.asService<{ a: boolean }>("select plan_available('pro_founding_monthly') as a")).rows[0].a).toBe(false);
    expect((await db.asService<{ n: number | null }>("select plan_spots_left('pro_monthly') as n")).rows[0].n).toBeNull();
    // A free trial does not use a founding spot.
    await db.asService("delete from subscriptions where user_id = $1", [ids.other]);
    await db.asService("update plans set max_subscribers = 300 where is_founding");
  });

  it("an offer past its end date cannot be bought", async () => {
    await db.asService("update plans set available_until = now() - interval '1 day' where code = 'pro_pass_1m'");
    expect((await db.asService<{ a: boolean }>("select plan_available('pro_pass_1m') as a")).rows[0].a).toBe(false);
    await db.asService("update plans set available_until = null where code = 'pro_pass_1m'");
  });
});

describe("Who may read and write plans and payments (RLS)", () => {
  it("visitors and users read the public, active plans only; the Admin reads all", async () => {
    const visible = (who: string | null) => db.as(who, (s) => count(s, "select 1 from plans"));
    expect(await visible(null)).toBe(8);
    expect(await visible(ids.free)).toBe(8);
    expect(await visible(ids.admin)).toBe(10);
  });

  it("users read only their own subscriptions and payments; the Admin reads all", async () => {
    await db.asService(
      `insert into payments (user_id, gateway, gateway_payment_id, amount_cents, currency, status)
       values ($1, 'paddle', 'p1', 499, 'USD', 'paid'), ($2, 'paddle', 'p2', 499, 'USD', 'paid')`,
      [ids.pro, ids.business],
    );
    expect(await db.as(ids.pro, (s) => count(s, "select 1 from subscriptions"))).toBe(1);
    expect(await db.as(ids.pro, (s) => count(s, "select 1 from payments"))).toBe(1);
    expect(await db.as(ids.free, (s) => count(s, "select 1 from subscriptions"))).toBe(0);
    expect(await db.as(ids.admin, (s) => count(s, "select 1 from payments"))).toBe(2);
  });

  it("nobody can write subscriptions, payments, webhook events, coupons or plans from a normal login", async () => {
    const attempts = [
      `insert into subscriptions (user_id, plan_code, gateway, status, currency) values ('${ids.free}', 'pro_monthly', 'manual', 'active', 'LKR')`,
      `insert into payments (gateway, gateway_payment_id, amount_cents, currency, status) values ('paddle', 'x', 1, 'USD', 'paid')`,
      `insert into webhook_events (gateway, event_id, payload) values ('paddle', 'e1', '{}')`,
    ];
    for (const sql of attempts) {
      await expect(db.as(ids.free, (s) => s.query(sql))).rejects.toThrow(/row-level security|permission/);
      await expect(db.as(ids.admin, (s) => s.query(sql))).rejects.toThrow(/row-level security|permission/);
    }
    await expect(db.as(ids.free, (s) => s.query("insert into coupons (code, percent_off) values ('FREE100', 100)"))).rejects.toThrow(/row-level security/);
    expect((await db.as(ids.free, (s) => s.query("update plans set prices = '{}'"))).affectedRows).toBe(0);
    await db.as(ids.admin, (s) => s.query("insert into coupons (code, percent_off) values ('LAUNCH10', 10)"));
  });

  it("the same webhook event is stored only once", async () => {
    const insert = () =>
      db.asService("insert into webhook_events (gateway, event_id, payload) values ('paddle', 'evt_1', '{}')");
    await insert();
    await expect(insert()).rejects.toThrow(/duplicate|unique/);
  });
});

describe("Feature switches: rules the database enforces", () => {
  it("everyone can read the list of switches; only the Admin can change them", async () => {
    expect(await db.as(null, (s) => count(s, "select 1 from feature_flags"))).toBeGreaterThan(20);
    expect((await db.as(ids.free, (s) => s.query("update feature_flags set status = 'on' where key = 'credit_book'"))).affectedRows).toBe(0);
    await db.as(ids.admin, (s) => s.query("update feature_flags set status = 'beta' where key = 'credit_book'"));
    await db.as(ids.admin, (s) => s.query("update feature_flags set status = 'off' where key = 'credit_book'"));
  });

  it("core features are always on and can't be switched off", async () => {
    for (const key of ["calculators", "daily_records", "monthly_summary", "csv_export", "custom_categories"]) {
      expect(await enabled(ids.free, key)).toBe(true);
      await expect(db.as(ids.admin, (s) => s.query("update feature_flags set status = 'off' where key = $1", [key]))).rejects.toThrow();
    }
  });

  it("a 'free forever' promise can never be removed or moved to Pro", async () => {
    await expect(db.as(ids.admin, (s) => s.query("update feature_flags set locked_free = false where key = 'real_profit'"))).rejects.toThrow(/locked_free_cannot_be_removed/);
    await expect(db.as(ids.admin, (s) => s.query("update feature_flags set min_plan = 'pro' where key = 'real_profit'"))).rejects.toThrow();
  });

  it("new features start Off", async () => {
    for (const key of ["credit_book", "pdf_reports", "voice_entry", "team"]) expect(await enabled(ids.pro, key)).toBe(false);
  });

  it("Off beats everything, even a tester switched on by hand", async () => {
    await db.asService("insert into feature_overrides (feature_key, user_id, enabled) values ('credit_book', $1, true)", [ids.free]);
    expect(await enabled(ids.free, "credit_book")).toBe(false);
  });

  it("Beta is only for users switched on by hand", async () => {
    await db.asService("update feature_flags set status = 'beta' where key = 'credit_book'");
    expect(await enabled(ids.free, "credit_book")).toBe(true); // tester
    expect(await enabled(ids.other, "credit_book")).toBe(false); // everyone else
    await db.asService("update feature_flags set status = 'on' where key = 'credit_book'");
    expect(await enabled(ids.other, "credit_book")).toBe(true);
    // A tester can also be switched OFF while the feature is on.
    await db.asService("update feature_overrides set enabled = false where feature_key = 'credit_book'");
    expect(await enabled(ids.free, "credit_book")).toBe(false);
  });

  it("Pro features follow the plan; Business-only features need Business", async () => {
    await db.asService("update feature_flags set status = 'on' where key in ('pdf_reports', 'team')");
    expect([await enabled(ids.free, "pdf_reports"), await enabled(ids.pro, "pdf_reports")]).toEqual([false, true]);
    expect([await enabled(ids.pro, "team"), await enabled(ids.business, "team")]).toEqual([false, true]);
    await db.asService("update feature_flags set status = 'off' where key in ('pdf_reports', 'team')");
  });

  it("a rollout of 0% reaches nobody and 100% everybody; a guest is never in a partial rollout", async () => {
    await db.asService("update feature_flags set status = 'on', rollout_percent = 0 where key = 'goals'");
    expect(await enabled(ids.free, "goals")).toBe(false);
    await db.asService("update feature_flags set rollout_percent = 100 where key = 'goals'");
    expect(await enabled(ids.free, "goals")).toBe(true);
    await db.asService("update feature_flags set rollout_percent = 50 where key = 'goals'");
    expect(await enabled(null, "goals")).toBe(false);
    // The same user always gets the same answer.
    expect(await enabled(ids.free, "goals")).toBe(await enabled(ids.free, "goals"));
    await db.asService("update feature_flags set status = 'off', rollout_percent = 100 where key = 'goals'");
  });

  it("an unknown feature is off, and my_features() lists what is on for me", async () => {
    expect(await enabled(ids.free, "no_such_feature")).toBe(false);
    const list = await db.as(ids.free, async (s) => (await s.query<{ f: string[] }>("select my_features() as f")).rows[0].f);
    expect(list).toEqual(expect.arrayContaining(["calculators", "daily_records", "custom_categories", "products"]));
    expect(list).not.toContain("voice_entry");
  });
});
