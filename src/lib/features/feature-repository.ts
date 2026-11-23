import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";
import { MEMBER_ROLES, type MemberRole } from "@/lib/roles";
import {
  featureRuleError,
  type FeatureFlag,
  type FeaturePatch,
  type FeaturePlan,
  type FeatureRuleError,
  type FeatureStatus,
} from "./flag";

/** Thrown when Supabase refuses or fails a feature switch query; `rule` says which database rule refused a change. */
export class FeatureQueryError extends Error {
  readonly rule: FeatureRuleError;

  constructor(action: string, cause: { message: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "FeatureQueryError";
    this.rule = featureRuleError(cause.message);
  }
}

const COLUMNS =
  "key, name, description, category, status, min_plan, locked_free, always_on, roles, locales, countries, rollout_percent, whats_new, updated_at" as const;

type FlagRow = Pick<
  Tables<"feature_flags">,
  | "key"
  | "name"
  | "description"
  | "category"
  | "status"
  | "min_plan"
  | "locked_free"
  | "always_on"
  | "roles"
  | "locales"
  | "countries"
  | "rollout_percent"
  | "whats_new"
  | "updated_at"
>;

function toFlag(row: FlagRow): FeatureFlag {
  const roles = row.roles?.filter((role): role is MemberRole => (MEMBER_ROLES as readonly string[]).includes(role)) ?? null;
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status as FeatureStatus,
    minPlan: row.min_plan as FeaturePlan,
    lockedFree: row.locked_free,
    alwaysOn: row.always_on,
    roles: roles && roles.length > 0 ? roles : null,
    locales: row.locales,
    countries: row.countries,
    rolloutPercent: row.rollout_percent,
    whatsNew: row.whats_new,
    updatedAt: row.updated_at,
  };
}

/** One person on a feature's tester list: switched on or off for them alone. */
export interface FeatureTester {
  userId: string;
  enabled: boolean;
}

/**
 * Reads and changes the feature switches (spec D7). Everyone may read the list
 * (it holds no personal data); only an Admin may change it, and the database
 * enforces that again with Row Level Security and its own rules: a core
 * feature stays on, and a feature promised free for ever stays free.
 */
export class FeatureRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Every switch, grouped by category and then by name. */
  async list(): Promise<FeatureFlag[]> {
    const { data, error } = await this.db.from("feature_flags").select(COLUMNS).order("category").order("name");
    if (error) throw new FeatureQueryError("load the feature switches", error);
    return data.map(toFlag);
  }

  /** The keys that are on for the logged-in person, as far as the database can tell (status, plan, testers, rollout). */
  async enabledKeys(): Promise<string[]> {
    const { data, error } = await this.db.rpc("my_features");
    if (error) throw new FeatureQueryError("load the features that are on", error);
    return data;
  }

  /** Saves the changes the Admin made to one switch and returns it as it is now. */
  async update(key: string, patch: FeaturePatch, adminId: string): Promise<FeatureFlag> {
    const values: Database["public"]["Tables"]["feature_flags"]["Update"] = { updated_by: adminId };
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.minPlan !== undefined) values.min_plan = patch.minPlan;
    if (patch.roles !== undefined) values.roles = patch.roles;
    if (patch.locales !== undefined) values.locales = patch.locales;
    if (patch.countries !== undefined) values.countries = patch.countries;
    if (patch.rolloutPercent !== undefined) values.rollout_percent = patch.rolloutPercent;
    if (patch.whatsNew !== undefined) values.whats_new = patch.whatsNew;

    const { data, error } = await this.db.from("feature_flags").update(values).eq("key", key).select(COLUMNS);
    if (error) throw new FeatureQueryError("save the feature switch", error);
    // RLS hides rows instead of failing, so "0 rows changed" means "not an Admin" or "no such switch".
    if (data.length === 0) throw new FeatureQueryError("save the feature switch", { message: "no such switch or not allowed" });
    return toFlag(data[0]);
  }

  /** The people this feature is switched on or off for individually. */
  async testers(key: string): Promise<FeatureTester[]> {
    const { data, error } = await this.db.from("feature_overrides").select("user_id, enabled").eq("feature_key", key);
    if (error) throw new FeatureQueryError("load the testers", error);
    return data.map((row) => ({ userId: row.user_id, enabled: row.enabled }));
  }

  /** Switches the feature on (or off) for one person, whatever its status says (unless it is Off for everyone). */
  async setTester(key: string, userId: string, enabled: boolean): Promise<void> {
    const { error } = await this.db
      .from("feature_overrides")
      .upsert({ feature_key: key, user_id: userId, enabled }, { onConflict: "feature_key,user_id" });
    if (error) throw new FeatureQueryError("save the tester", error);
  }

  async removeTester(key: string, userId: string): Promise<void> {
    const { error } = await this.db.from("feature_overrides").delete().eq("feature_key", key).eq("user_id", userId);
    if (error) throw new FeatureQueryError("remove the tester", error);
  }
}
