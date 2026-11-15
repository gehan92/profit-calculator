import type { AppLocale } from "@/i18n/config";
import type messages from "@/messages/en.json";

/**
 * Type-safe translations: a wrong message key or locale is a compile error.
 * English (`en.json`) is the reference; Sinhala and Tamil must match it
 * (checked by `src/i18n/messages.test.ts`).
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}
