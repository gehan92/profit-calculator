import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { isSupportedCurrency } from "@/lib/money";

/**
 * The website-wide switches the Admin controls (Part D4 "Settings", Part F3
 * `app_settings`): maintenance mode, feature flags, Pro limits, defaults for
 * new shops and the support WhatsApp number. Each key holds one small JSON
 * value; the rules for each are written here once and used by the Settings
 * screen, the Server Action and whoever reads a setting later.
 */

export const SETTING_KEYS = ["maintenance", "features", "pro_limits", "defaults", "support"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** A phone number for WhatsApp: optional +, then 8–15 digits. Spaces and dashes are allowed when typing. */
const WHATSAPP_NUMBER = /^\+?\d{8,15}$/;

export const settingSchemas = {
  /** Maintenance mode: calculators still work, My Business shows "Back soon" (Part C2). */
  maintenance: z.strictObject({ on: z.boolean() }),
  /** Feature flags: screens that can be switched off for everyone. */
  features: z.strictObject({ products: z.boolean(), team: z.boolean(), pdf: z.boolean() }),
  /** Pro plan limits per shop (Part D3: up to 3 Staff + 2 Viewers). */
  pro_limits: z.strictObject({
    staff: z.number().int().min(0).max(50),
    viewers: z.number().int().min(0).max(50),
  }),
  /** Language and currency a new shop starts with. */
  defaults: z.strictObject({
    locale: z.enum(LOCALES),
    currency: z.string().refine(isSupportedCurrency, "unsupported currency"),
  }),
  /** The number behind the "WhatsApp support" button; empty hides the button. */
  support: z.strictObject({
    whatsapp: z
      .string()
      .transform((value) => value.replace(/[\s-]/g, ""))
      .refine((value) => value === "" || WHATSAPP_NUMBER.test(value), "not a phone number"),
  }),
} as const satisfies Record<SettingKey, z.ZodType>;

export type AppSettings = { [Key in SettingKey]: z.output<(typeof settingSchemas)[Key]> };

/** What each setting is when the database has no (valid) value: the seed values of migration 0001. */
export const DEFAULT_SETTINGS: AppSettings = {
  maintenance: { on: false },
  features: { products: true, team: false, pdf: false },
  pro_limits: { staff: 3, viewers: 2 },
  defaults: { locale: "en", currency: "LKR" },
  support: { whatsapp: "" },
};

export function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === "string" && (SETTING_KEYS as readonly string[]).includes(value);
}

/**
 * Turns the rows of `app_settings` into one settings object. A missing row, or
 * a value that does not follow the rules, falls back to the default, so a
 * hand-edited database can never break a page.
 */
export function parseSettings(rows: readonly { key: string; value: unknown }[]): AppSettings {
  const settings: AppSettings = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    if (!isSettingKey(row.key)) continue;
    const parsed = settingSchemas[row.key].safeParse(row.value);
    if (parsed.success) (settings[row.key] as unknown) = parsed.data;
  }
  return settings;
}
