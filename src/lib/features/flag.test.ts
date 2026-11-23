import { describe, expect, it } from "vitest";
import {
  allowedHere,
  editableFields,
  featurePatchSchema,
  featureRuleError,
  resolveFeatures,
  type FeatureFlag,
} from "./flag";

const flag = (overrides: Partial<FeatureFlag> = {}): FeatureFlag => ({
  key: "credit_book",
  name: "Credit book",
  description: null,
  category: "money",
  status: "on",
  minPlan: "free",
  lockedFree: false,
  alwaysOn: false,
  roles: null,
  locales: null,
  countries: null,
  rolloutPercent: 100,
  whatsNew: null,
  updatedAt: "2026-11-23T00:00:00Z",
  ...overrides,
});

describe("allowedHere (limits by role, language and country)", () => {
  it("a feature without limits shows for everyone", () => {
    expect(allowedHere(flag(), { role: "viewer", locale: "ta" })).toBe(true);
    expect(allowedHere(flag(), { role: null, locale: "en" })).toBe(true);
  });

  it("a role limit shows the feature only to those roles", () => {
    const ownerOnly = flag({ roles: ["owner"] });
    expect(allowedHere(ownerOnly, { role: "owner", locale: "en" })).toBe(true);
    expect(allowedHere(ownerOnly, { role: "staff", locale: "en" })).toBe(false);
    expect(allowedHere(ownerOnly, { role: null, locale: "en" })).toBe(false);
  });

  it("a language limit shows the feature only in those languages", () => {
    const voice = flag({ locales: ["si", "ta", "en"] });
    expect(allowedHere(voice, { role: "owner", locale: "si" })).toBe(true);
    expect(allowedHere(voice, { role: "owner", locale: "hi" })).toBe(false);
  });

  it("a country limit shows the feature only in those countries, and never when the country is unknown", () => {
    const vat = flag({ countries: ["GB", "DE"] });
    expect(allowedHere(vat, { role: "owner", locale: "en", country: "gb" })).toBe(true);
    expect(allowedHere(vat, { role: "owner", locale: "en", country: "LK" })).toBe(false);
    expect(allowedHere(vat, { role: "owner", locale: "en", country: null })).toBe(false);
    expect(allowedHere(vat, { role: "owner", locale: "en" })).toBe(false);
  });

  it("every limit has to be met", () => {
    const strict = flag({ roles: ["owner"], locales: ["si"] });
    expect(allowedHere(strict, { role: "owner", locale: "si" })).toBe(true);
    expect(allowedHere(strict, { role: "owner", locale: "en" })).toBe(false);
    expect(allowedHere(strict, { role: "staff", locale: "si" })).toBe(false);
  });

  it("a core feature can never be limited", () => {
    const core = flag({ alwaysOn: true, roles: ["owner"], locales: ["en"], countries: ["GB"] });
    expect(allowedHere(core, { role: "viewer", locale: "ta", country: "LK" })).toBe(true);
  });
});

describe("resolveFeatures", () => {
  const flags = [
    flag({ key: "calculators", alwaysOn: true, roles: ["owner"] }),
    flag({ key: "products" }),
    flag({ key: "team", roles: ["owner"] }),
    flag({ key: "voice_entry", locales: ["si"] }),
  ];

  it("keeps the keys the database says are on and the limits allow", () => {
    const on = resolveFeatures(["calculators", "products", "team", "voice_entry"], flags, { role: "staff", locale: "en" });
    expect([...on].sort()).toEqual(["calculators", "products"]);
  });

  it("never turns on what the database says is off, whatever the limits", () => {
    const on = resolveFeatures(["products"], flags, { role: "owner", locale: "si" });
    expect([...on]).toEqual(["products"]);
  });

  it("ignores keys that are not a known switch", () => {
    expect([...resolveFeatures(["mystery"], flags, { role: "owner", locale: "en" })]).toEqual([]);
  });
});

describe("featurePatchSchema", () => {
  it("accepts one or many changes", () => {
    expect(featurePatchSchema.parse({ status: "beta" })).toEqual({ status: "beta" });
    expect(featurePatchSchema.parse({ minPlan: "pro", rolloutPercent: 25, roles: ["owner", "owner", "viewer"] })).toEqual({
      minPlan: "pro",
      rolloutPercent: 25,
      roles: ["owner", "viewer"],
    });
  });

  it("refuses an empty change, an unknown field and a bad value", () => {
    expect(featurePatchSchema.safeParse({}).success).toBe(false);
    expect(featurePatchSchema.safeParse({ alwaysOn: false }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ lockedFree: false }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ status: "maybe" }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ minPlan: "gold" }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ rolloutPercent: 101 }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ rolloutPercent: -1 }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ rolloutPercent: 12.5 }).success).toBe(false);
  });

  it("null means all roles, languages or countries; an empty list is not allowed", () => {
    expect(featurePatchSchema.parse({ roles: null, locales: null, countries: null })).toEqual({ roles: null, locales: null, countries: null });
    expect(featurePatchSchema.safeParse({ roles: [] }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ locales: [] }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ countries: [] }).success).toBe(false);
  });

  it("only knows our roles, our language codes and two-letter capital country codes", () => {
    expect(featurePatchSchema.safeParse({ roles: ["admin"] }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ locales: ["xx"] }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ locales: ["si", "en-GB"] }).success).toBe(true);
    expect(featurePatchSchema.safeParse({ countries: ["lk"] }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ countries: ["LKA"] }).success).toBe(false);
    expect(featurePatchSchema.parse({ countries: ["LK", "LK", "GB"] })).toEqual({ countries: ["LK", "GB"] });
  });

  it("trims the 'What's new' note, empties it to null, and refuses more than 200 letters", () => {
    expect(featurePatchSchema.parse({ whatsNew: "  New: credit book  " })).toEqual({ whatsNew: "New: credit book" });
    expect(featurePatchSchema.parse({ whatsNew: "   " })).toEqual({ whatsNew: null });
    expect(featurePatchSchema.parse({ whatsNew: null })).toEqual({ whatsNew: null });
    expect(featurePatchSchema.safeParse({ whatsNew: "a".repeat(201) }).success).toBe(false);
    expect(featurePatchSchema.safeParse({ whatsNew: "a".repeat(200) }).success).toBe(true);
  });
});

describe("featureRuleError", () => {
  it("names the database's rules", () => {
    expect(featureRuleError("core_feature_always_on")).toBe("coreAlwaysOn");
    expect(featureRuleError("locked_free_cannot_be_removed")).toBe("freePromise");
    expect(featureRuleError('new row for relation "feature_flags" violates check constraint "feature_flags_check"')).toBe("freePromise");
    expect(featureRuleError("something else")).toBe("other");
    expect(featureRuleError(undefined)).toBe("other");
  });
});

describe("editableFields (what the screen greys out)", () => {
  it("a core feature cannot be switched off or limited", () => {
    expect(editableFields(flag({ alwaysOn: true }))).toEqual({ status: false, minPlan: true, limits: false });
  });

  it("a feature promised free for ever cannot move to Pro", () => {
    expect(editableFields(flag({ lockedFree: true }))).toEqual({ status: true, minPlan: false, limits: true });
  });

  it("an ordinary feature can be changed in every way", () => {
    expect(editableFields(flag())).toEqual({ status: true, minPlan: true, limits: true });
  });
});
