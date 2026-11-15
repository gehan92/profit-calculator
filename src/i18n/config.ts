/**
 * Single source of truth for the languages the website supports (Part F4.3).
 *
 * To add a language later: add its code here, add a `messages/<code>.json`
 * file, and the router, language switch and formatters pick it up.
 */
export const LOCALES = ["en", "si", "ta"] as const;

export type AppLocale = (typeof LOCALES)[number];

/** English is the default language (Key decisions). */
export const DEFAULT_LOCALE: AppLocale = "en";

/** How each language is shown in the language switch. */
export const LOCALE_LABELS: Record<AppLocale, { short: string; full: string }> = {
  en: { short: "EN", full: "English" },
  si: { short: "සිං", full: "සිංහල" },
  ta: { short: "த", full: "தமிழ்" },
};

/**
 * The full locale passed to `Intl` for numbers and dates.
 * Using the Sri Lanka region gives local formats (e.g. "Rs" for LKR).
 */
export const INTL_LOCALE: Record<AppLocale, string> = {
  en: "en-LK",
  si: "si-LK",
  ta: "ta-LK",
};

/** Locale names used in Open Graph tags for WhatsApp/Facebook previews. */
export const OPEN_GRAPH_LOCALE: Record<AppLocale, string> = {
  en: "en_LK",
  si: "si_LK",
  ta: "ta_LK",
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
