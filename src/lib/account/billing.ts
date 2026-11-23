/**
 * What the Account → Plan & billing tab says about a person's subscription
 * (spec D6). Pure rules, no database: the repository hands in the rows.
 */
export type PlanTier = "free" | "pro" | "business";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

/** The one subscription (if any) that decides the person's plan right now. */
export interface SubscriptionInfo {
  planName: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  /** A pass ("12-month pass") is paid once and simply ends; a subscription renews. */
  oneTime: boolean;
  /** `null` = no end date known. */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** What to show in the "Current plan" card. */
export type PlanState =
  /** No paid plan: the Free plan. */
  | { kind: "free" }
  /** In the free trial of a paid plan; `date` is when the trial ends. */
  | { kind: "trial"; date: string | null }
  /** Paid and renewing; `date` is the next payment. */
  | { kind: "renews"; date: string | null }
  /** Paid, but will not renew (cancelled, or a pass): it ends on `date`. */
  | { kind: "ends"; date: string | null }
  /** The last payment failed: the plan still works until `date`. */
  | { kind: "pastDue"; date: string | null };

/**
 * Whether this subscription still gives paid features: the same rule as the
 * database function `user_tier()` (trial, active or past due, until the paid
 * period ends). An expired or cancelled one means the Free plan.
 */
export function isPaidNow(subscription: SubscriptionInfo | null, now: Date = new Date()): boolean {
  if (!subscription) return false;
  if (!["trialing", "active", "past_due"].includes(subscription.status)) return false;
  return subscription.periodEnd === null || new Date(subscription.periodEnd).getTime() > now.getTime();
}

export function planState(subscription: SubscriptionInfo | null, now: Date = new Date()): PlanState {
  if (!subscription || !isPaidNow(subscription, now)) return { kind: "free" };

  const date = subscription.periodEnd;
  if (subscription.status === "trialing") return { kind: "trial", date };
  if (subscription.status === "past_due") return { kind: "pastDue", date };
  if (subscription.oneTime || subscription.cancelAtPeriodEnd) return { kind: "ends", date };
  return { kind: "renews", date };
}

/** One row of the billing history. Amounts are in cents of `currency`. */
export interface PaymentInfo {
  id: string;
  paidAt: string;
  amountCents: number;
  currency: string;
  status: "paid" | "failed" | "refunded" | "partially_refunded";
  /** Where the gateway keeps the invoice; `null` when there is none. */
  invoiceUrl: string | null;
}

/**
 * Only a secure (https) web address becomes an invoice link, so a bad row can
 * never turn into a script ("javascript:…") or an unsafe link on the screen.
 */
export function safeInvoiceUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
