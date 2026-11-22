import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, isSettingKey, parseSettings, SETTING_KEYS, settingSchemas } from "./app-settings";

describe("setting rules", () => {
  it("accepts the seed values of the database", () => {
    for (const key of SETTING_KEYS) {
      expect(settingSchemas[key].safeParse(DEFAULT_SETTINGS[key]).success).toBe(true);
    }
  });

  it("maintenance and features need real true/false values, and nothing extra", () => {
    expect(settingSchemas.maintenance.safeParse({ on: "yes" }).success).toBe(false);
    expect(settingSchemas.maintenance.safeParse({ on: true, note: "x" }).success).toBe(false);
    expect(settingSchemas.features.safeParse({ products: true, team: false }).success).toBe(false);
  });

  it("Pro limits are whole numbers from 0 to 50", () => {
    const ok = (staff: number, viewers: number) => settingSchemas.pro_limits.safeParse({ staff, viewers }).success;
    expect(ok(0, 50)).toBe(true);
    expect(ok(3, 2)).toBe(true);
    expect(ok(-1, 2)).toBe(false);
    expect(ok(51, 2)).toBe(false);
    expect(ok(2.5, 2)).toBe(false);
  });

  it("defaults need a known language and a currency the app can show", () => {
    expect(settingSchemas.defaults.safeParse({ locale: "si", currency: "USD" }).success).toBe(true);
    expect(settingSchemas.defaults.safeParse({ locale: "fr", currency: "LKR" }).success).toBe(false);
    expect(settingSchemas.defaults.safeParse({ locale: "en", currency: "XYZ" }).success).toBe(false);
  });

  it.each([
    ["+94 77 123 4567", "+94771234567"],
    ["0771234567", "0771234567"],
    ["077-123-4567", "0771234567"],
    ["", ""],
  ])("support number %j is stored as %j", (typed, stored) => {
    const parsed = settingSchemas.support.safeParse({ whatsapp: typed });
    expect(parsed.success && parsed.data.whatsapp).toBe(stored);
  });

  it.each(["abc", "12345", "+94 (77) 1234567", "07712345678901234567", "https://wa.me/94771234567"])(
    "support number %j is refused",
    (typed) => {
      expect(settingSchemas.support.safeParse({ whatsapp: typed }).success).toBe(false);
    },
  );
});

describe("parseSettings", () => {
  it("uses the stored values", () => {
    const settings = parseSettings([
      { key: "maintenance", value: { on: true } },
      { key: "pro_limits", value: { staff: 5, viewers: 1 } },
      { key: "support", value: { whatsapp: "+94771234567" } },
    ]);
    expect(settings.maintenance).toEqual({ on: true });
    expect(settings.pro_limits).toEqual({ staff: 5, viewers: 1 });
    expect(settings.support.whatsapp).toBe("+94771234567");
    expect(settings.features).toEqual(DEFAULT_SETTINGS.features);
  });

  it("falls back to the default for a missing, broken or unknown row", () => {
    const settings = parseSettings([
      { key: "maintenance", value: "on" },
      { key: "features", value: null },
      { key: "something_else", value: { a: 1 } },
    ]);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("never changes the shared defaults", () => {
    const settings = parseSettings([{ key: "maintenance", value: { on: true } }]);
    settings.features.products = false;
    expect(DEFAULT_SETTINGS.maintenance.on).toBe(false);
    expect(DEFAULT_SETTINGS.features.products).toBe(true);
  });
});

describe("isSettingKey", () => {
  it("knows the five settings", () => {
    expect(SETTING_KEYS).toHaveLength(5);
    expect(isSettingKey("maintenance")).toBe(true);
    expect(isSettingKey("__proto__")).toBe(false);
    expect(isSettingKey(7)).toBe(false);
  });
});
