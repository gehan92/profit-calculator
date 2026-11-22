import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Thrown when Supabase refuses or fails a profile query. */
export class ProfileQueryError extends Error {
  constructor(action: string, cause: { message: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "ProfileQueryError";
  }
}

/**
 * Reads and writes the logged-in person's own profile (Part F3 `profiles`).
 * Like the other repositories it uses the person's own Supabase client:
 * Row Level Security lets them read their profile and change only their name
 * and support access (the database grants no other column to users, so they
 * can never make themselves an admin).
 */
export class ProfileRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * Whether an Admin has paused this account (`blocked`, Part D4 "Block").
   * A missing profile counts as active: the database refuses a blocked or
   * profile-less person's writes anyway (`is_active()`), so this only decides
   * which screen to show.
   */
  async isBlocked(userId: string): Promise<boolean> {
    const { data, error } = await this.db.from("profiles").select("status").eq("id", userId).maybeSingle();

    if (error) throw new ProfileQueryError("check the account status", error);
    return data?.status === "blocked";
  }

  /** The time support access ends, or `null` when it was never switched on / was switched off. */
  async getSupportAccessUntil(userId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select("support_access_until")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new ProfileQueryError("load the profile", error);
    return data?.support_access_until ?? null;
  }

  /** Switches support access on (an end time) or off (`null`). */
  async setSupportAccessUntil(userId: string, until: Date | null): Promise<void> {
    const { data, error } = await this.db
      .from("profiles")
      .update({ support_access_until: until ? until.toISOString() : null })
      .eq("id", userId)
      .select("id");

    if (error) throw new ProfileQueryError("change support access", error);
    // RLS hides rows instead of failing, so "0 rows changed" means "no such profile".
    if (data.length === 0) throw new ProfileQueryError("change support access", { message: "no profile" });
  }
}
