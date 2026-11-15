import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "./config";

/**
 * URL-based languages: /en/... (default), /si/..., /ta/...
 * next-intl remembers the visitor's choice in a cookie, and on the first
 * visit it follows the browser language when it is Sinhala or Tamil.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localeDetection: true,
});
