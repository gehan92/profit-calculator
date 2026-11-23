import { z } from "zod";
import type { MemberRole } from "@/lib/roles";
import { MEMBER_ROLES } from "@/lib/roles";

/**
 * Feature switches (spec D7): every feature has a switch the Admin controls in
 * Admin → Features, so a new feature can be tested, rolled out slowly or turned
 * off at once without new code. The database decides most of it (status, plan,
 * tester list, rollout %) in `my_features()`; this file holds the rest: the
 * limits by role, language and country, and the rules for editing a switch.
 */

export const FEATURE_STATUSES = ["off", "beta", "on"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_PLANS = ["free", "pro", "business"] as const;
export type FeaturePlan = (typeof FEATURE_PLANS)[number];

/** The language codes the database accepts (migration 0005); only some are switched on for the website. */
export const FEATURE_LOCALES = ["en", "si", "ta", "en-GB", "hi", "zh", "es", "fr", "de", "ru", "uk"] as const;

/** One row of `feature_flags`. `null` for roles, languages and countries means "all". */
export interface FeatureFlag {
  key: string;
  name: string;
  description: string | null;
  category: string;
  status: FeatureStatus;
  minPlan: FeaturePlan;
  /** Promised free for ever: can never move to Pro or lose the promise. */
  lockedFree: boolean;
  /** Core: can never be switched off. */
  alwaysOn: boolean;
  roles: MemberRole[] | null;
  locales: string[] | null;
  countries: string[] | null;
  rolloutPercent: number;
  whatsNew: string | null;
  updatedAt: string;
}

/** Where a feature is being asked about: the person's role in their shop, the page's language, their country. */
export interface FeatureContext {
  role: MemberRole | null;
  locale: string;
  /** ISO code ("LK"), or `null` when it is not known. */
  country?: string | null;
}

/**
 * Whether the limits by role, language and country let this feature show here.
 * A core feature can never be limited. A limit that cannot be checked (the
 * country is not known) counts as "not allowed": a feature meant for some
 * countries never leaks to everyone.
 */
export function allowedHere(flag: FeatureFlag, context: FeatureContext): boolean {
  if (flag.alwaysOn) return true;
  if (flag.roles && (!context.role || !flag.roles.includes(context.role))) return false;
  if (flag.locales && !flag.locales.includes(context.locale)) return false;
  if (flag.countries && (!context.country || !flag.countries.includes(context.country.toUpperCase()))) return false;
  return true;
}

/**
 * The features that are on for this person here: the keys the database says are
 * on for them (`my_features()`: status, plan, tester list, rollout) that the
 * limits by role, language and country also allow.
 */
export function resolveFeatures(
  enabledKeys: Iterable<string>,
  flags: readonly FeatureFlag[],
  context: FeatureContext,
): Set<string> {
  const enabled = new Set(enabledKeys);
  const on = new Set<string>();
  for (const flag of flags) {
    if (enabled.has(flag.key) && allowedHere(flag, context)) on.add(flag.key);
  }
  return on;
}

// ---------------------------------------------------------------- editing a switch

export const WHATS_NEW_MAX_LENGTH = 200;

/** What the Admin may change on one switch. Everything is optional; at least one thing must be sent. */
export const featurePatchSchema = z
  .strictObject({
    status: z.enum(FEATURE_STATUSES),
    minPlan: z.enum(FEATURE_PLANS),
    /** `null` = all roles. */
    roles: z
      .array(z.enum(MEMBER_ROLES))
      .min(1)
      .nullable()
      .transform((roles) => (roles ? [...new Set(roles)] : null)),
    /** `null` = all languages. */
    locales: z
      .array(z.enum(FEATURE_LOCALES))
      .min(1)
      .nullable()
      .transform((locales) => (locales ? [...new Set(locales)] : null)),
    /** `null` = all countries; two-letter ISO codes, written in capitals. */
    countries: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .min(1)
      .max(60)
      .nullable()
      .transform((countries) => (countries ? [...new Set(countries)] : null)),
    rolloutPercent: z.number().int().min(0).max(100),
    /** A short "What's new" note; empty removes it. */
    whatsNew: z
      .string()
      .transform((text) => text.trim())
      .pipe(z.string().max(WHATS_NEW_MAX_LENGTH))
      .transform((text) => (text === "" ? null : text))
      .nullable(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "nothing to change");

export type FeaturePatch = z.output<typeof featurePatchSchema>;

/** Why the database refused a change (its rule names, see migration 0006). */
export type FeatureRuleError = "coreAlwaysOn" | "freePromise" | "other";

export function featureRuleError(message: string | undefined): FeatureRuleError {
  if (message?.includes("core_feature_always_on")) return "coreAlwaysOn";
  if (message?.includes("locked_free_cannot_be_removed") || message?.includes("feature_flags_check")) return "freePromise";
  return "other";
}

/**
 * Rules the screen applies before asking: it greys out what the database
 * would refuse anyway (the database still enforces them).
 */
export function editableFields(flag: FeatureFlag): { status: boolean; minPlan: boolean; limits: boolean } {
  return {
    /** A core feature is always on. */
    status: !flag.alwaysOn,
    /** A feature promised free for ever stays on the Free plan. */
    minPlan: !flag.lockedFree,
    /** Role, language and country limits make no sense on a core feature. */
    limits: !flag.alwaysOn,
  };
}
