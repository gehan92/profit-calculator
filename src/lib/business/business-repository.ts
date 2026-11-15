import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/i18n/config";
import type { Database, Tables } from "@/lib/supabase/types";

/** The shop fields pages need. */
export type Business = Pick<Tables<"businesses">, "id" | "name" | "currency" | "locale" | "plan">;

export type MemberRole = Database["public"]["Enums"]["member_role"];

export interface Membership {
  business: Business;
  role: MemberRole;
}

/** Thrown when Supabase refuses or fails a shop query. */
export class BusinessQueryError extends Error {
  constructor(action: string, cause: { message: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "BusinessQueryError";
  }
}

const BUSINESS_COLUMNS = "id, name, currency, locale, plan" as const;

/** Shop names are 1–60 characters (Part D2 Settings; database check). */
export const SHOP_NAME_MAX_LENGTH = 60;

/**
 * Reads and writes shops (Part F3 `businesses`, `business_members`).
 *
 * It always uses the logged-in user's Supabase client, so Row Level
 * Security decides what is allowed; this class adds no extra power.
 */
export class BusinessRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** The user's first shop and their role in it, or `null` if they have none yet. */
  async findFirstMembership(userId: string): Promise<Membership | null> {
    const { data, error } = await this.db
      .from("business_members")
      .select(`role, businesses (${BUSINESS_COLUMNS})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new BusinessQueryError("load the shop", error);
    if (!data?.businesses) return null;
    return { business: data.businesses, role: data.role };
  }

  /**
   * First login (Part D2): creates "My Shop" (in the person's language),
   * LKR, and the current language. A database trigger then adds the user
   * as its Owner.
   */
  async createDefault(ownerId: string, locale: AppLocale, name: string): Promise<Business> {
    const { data, error } = await this.db
      .from("businesses")
      .insert({ owner_id: ownerId, locale, name })
      .select(BUSINESS_COLUMNS)
      .single();

    if (error) throw new BusinessQueryError("create the shop", error);
    return data;
  }

  /** Returns the user's shop, creating the first one if needed. */
  async ensureFirstBusiness(
    userId: string,
    locale: AppLocale,
    defaultName: string,
  ): Promise<{ membership: Membership; created: boolean }> {
    const existing = await this.findFirstMembership(userId);
    if (existing) return { membership: existing, created: false };

    const business = await this.createDefault(userId, locale, defaultName);
    return { membership: { business, role: "owner" }, created: true };
  }

  /** Renames a shop. RLS allows this only for its Owner. */
  async rename(businessId: string, name: string): Promise<void> {
    const { data, error } = await this.db
      .from("businesses")
      .update({ name })
      .eq("id", businessId)
      .select("id");

    if (error) throw new BusinessQueryError("rename the shop", error);
    // RLS hides rows instead of failing, so "0 rows changed" means "not allowed".
    if (data.length === 0) {
      throw new BusinessQueryError("rename the shop", { message: "not the owner" });
    }
  }
}
