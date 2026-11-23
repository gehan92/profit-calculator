import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { PaymentInfo, PlanTier, SubscriptionInfo, SubscriptionStatus } from "./billing";

/** Thrown when Supabase refuses or fails a billing query. */
export class BillingQueryError extends Error {
  constructor(action: string, cause: { message: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "BillingQueryError";
  }
}

/** How many payments the history shows. */
export const BILLING_HISTORY_LIMIT = 50;

/**
 * Reads the logged-in person's own plan and payments (Account → Plan & billing).
 * Row Level Security lets a person read only their own rows, and nobody can
 * write them here: only the server (payment webhooks) does.
 */
export class BillingRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * The subscription that counts right now (a trial, active or past-due one,
   * the highest tier first), or `null` for the Free plan. Whether its paid
   * period is still running is decided by `planState`.
   */
  async currentSubscription(userId: string): Promise<SubscriptionInfo | null> {
    const { data, error } = await this.db
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end, plans!inner(name, tier, payment_mode)")
      .eq("user_id", userId)
      .in("status", ["trialing", "active", "past_due"]);
    if (error) throw new BillingQueryError("load the plan", error);

    const rank: Record<PlanTier, number> = { free: 0, pro: 1, business: 2 };
    const best = [...data].sort((a, b) => rank[b.plans.tier as PlanTier] - rank[a.plans.tier as PlanTier])[0];
    if (!best) return null;

    return {
      planName: best.plans.name,
      tier: best.plans.tier as PlanTier,
      status: best.status as SubscriptionStatus,
      oneTime: best.plans.payment_mode === "one_time",
      periodEnd: best.current_period_end,
      cancelAtPeriodEnd: best.cancel_at_period_end,
    };
  }

  /** The person's payments, newest first. */
  async payments(userId: string): Promise<PaymentInfo[]> {
    const { data, error } = await this.db
      .from("payments")
      .select("id, created_at, amount_cents, currency, status, invoice_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(BILLING_HISTORY_LIMIT);
    if (error) throw new BillingQueryError("load the payments", error);

    return data.map((row) => ({
      id: row.id,
      paidAt: row.created_at,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status as PaymentInfo["status"],
      invoiceUrl: row.invoice_url,
    }));
  }
}
