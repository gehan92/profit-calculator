import { describe, expect, it } from "vitest";
import { isPaidNow, planState, safeInvoiceUrl, type SubscriptionInfo } from "./billing";

const NOW = new Date("2026-11-23T10:00:00Z");
const FUTURE = "2026-12-23T10:00:00Z";
const PAST = "2026-11-01T10:00:00Z";

const pro: SubscriptionInfo = {
  planName: "Pro",
  tier: "pro",
  status: "active",
  oneTime: false,
  periodEnd: FUTURE,
  cancelAtPeriodEnd: false,
};

describe("isPaidNow (the same rule as the database's user_tier())", () => {
  it("no subscription means Free", () => {
    expect(isPaidNow(null, NOW)).toBe(false);
  });

  it.each(["trialing", "active", "past_due"] as const)("%s counts while the period has not ended", (status) => {
    expect(isPaidNow({ ...pro, status }, NOW)).toBe(true);
  });

  it.each(["cancelled", "expired"] as const)("%s never counts", (status) => {
    expect(isPaidNow({ ...pro, status }, NOW)).toBe(false);
  });

  it("an ended period is Free again, even if the status still says active", () => {
    expect(isPaidNow({ ...pro, periodEnd: PAST }, NOW)).toBe(false);
  });

  it("no end date means it counts (the gateway has not told us one)", () => {
    expect(isPaidNow({ ...pro, periodEnd: null }, NOW)).toBe(true);
  });
});

describe("planState", () => {
  it("shows Free when there is nothing paid", () => {
    expect(planState(null, NOW)).toEqual({ kind: "free" });
    expect(planState({ ...pro, status: "expired" }, NOW)).toEqual({ kind: "free" });
    expect(planState({ ...pro, periodEnd: PAST }, NOW)).toEqual({ kind: "free" });
  });

  it("a running subscription renews on the period end", () => {
    expect(planState(pro, NOW)).toEqual({ kind: "renews", date: FUTURE });
  });

  it("a subscription that will be cancelled at the period end says it ends", () => {
    expect(planState({ ...pro, cancelAtPeriodEnd: true }, NOW)).toEqual({ kind: "ends", date: FUTURE });
  });

  it("a pass (paid once) ends instead of renewing", () => {
    expect(planState({ ...pro, oneTime: true }, NOW)).toEqual({ kind: "ends", date: FUTURE });
  });

  it("a trial shows when the trial ends", () => {
    expect(planState({ ...pro, status: "trialing" }, NOW)).toEqual({ kind: "trial", date: FUTURE });
  });

  it("a failed payment is called out, and the plan works until the end date", () => {
    expect(planState({ ...pro, status: "past_due" }, NOW)).toEqual({ kind: "pastDue", date: FUTURE });
  });
});

describe("safeInvoiceUrl", () => {
  it("keeps a normal https address", () => {
    expect(safeInvoiceUrl("https://www.payhere.lk/invoice/123")).toBe("https://www.payhere.lk/invoice/123");
  });

  it("drops anything else", () => {
    expect(safeInvoiceUrl("javascript:alert(1)")).toBeNull();
    expect(safeInvoiceUrl("http://insecure.example/invoice")).toBeNull();
    expect(safeInvoiceUrl("data:text/html,hi")).toBeNull();
    expect(safeInvoiceUrl("not a url")).toBeNull();
    expect(safeInvoiceUrl("")).toBeNull();
    expect(safeInvoiceUrl(null)).toBeNull();
  });
});
