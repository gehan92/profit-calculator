import type { MetadataRoute } from "next";
import { CALCULATORS } from "@/config/calculators";
import { absoluteUrl, publicRoutes } from "@/config/site";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";

/**
 * /sitemap.xml (Part F4.5): every public page in all three languages,
 * each with links to its other language versions.
 *
 * Add a page here only once it exists (about, privacy, terms come on Day 14).
 */
const PUBLIC_PAGES = [publicRoutes.home, ...CALCULATORS.map((calculator) => calculator.href)];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap((path) => {
    const languages: Record<string, string> = Object.fromEntries(
      LOCALES.map((locale) => [locale, absoluteUrl(locale, path)]),
    );
    languages["x-default"] = absoluteUrl(DEFAULT_LOCALE, path);

    return LOCALES.map((locale) => ({
      url: absoluteUrl(locale, path),
      changeFrequency: "monthly" as const,
      priority: path === publicRoutes.home ? 1 : 0.8,
      alternates: { languages },
    }));
  });
}
