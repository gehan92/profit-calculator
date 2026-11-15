import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "./config";

/**
 * Loads the messages for the current request.
 *
 * The language comes from the `[locale]` URL segment via `next/root-params`
 * (the method recommended by next-intl for Next.js 16). Pages outside
 * `[locale]`, such as the English-only admin panel, fall back to English.
 */
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const locale = await resolveLocale(explicitLocale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

async function resolveLocale(explicitLocale: string | undefined): Promise<AppLocale> {
  const candidate = explicitLocale ?? (await readRootLocale());
  return isAppLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

/**
 * Server Actions cannot read root params and would crash here. Actions must
 * receive the language from their form instead (see src/actions); this
 * fallback only keeps a forgotten case from breaking the page.
 */
async function readRootLocale(): Promise<string | undefined> {
  try {
    return await rootLocale();
  } catch {
    return undefined;
  }
}
