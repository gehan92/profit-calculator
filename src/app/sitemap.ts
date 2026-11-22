import type { MetadataRoute } from "next";
import { CALCULATORS } from "@/config/calculators";
import { absoluteUrl, publicRoutes } from "@/config/site";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";

/**
 * /sitemap.xml (Part F4.5): every public page in all three languages,
 * each with links to its other language versions.
 *
 * Add a page here only once it exists. Login, feedback and the paused / offline
 * screens are left out on purpose: they have nothing for a search engine.
 */
const CALCULATOR_PAGES: string[] = CALCULATORS.map((calculator) => calculator.href);
const TEXT_PAGES: string[] = [publicRoutes.about, publicRoutes.privacy, publicRoutes.terms];
const PUBLIC_PAGES: string[] = [publicRoutes.home, ...CALCULATOR_PAGES, ...TEXT_PAGES];

function priorityOf(path: string): number {
  if (path === publicRoutes.home) return 1;
  return TEXT_PAGES.includes(path) ? 0.4 : 0.8;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap((path) => {
    const languages: Record<string, string> = Object.fromEntries(
      LOCALES.map((locale) => [locale, absoluteUrl(locale, path)]),
    );
    languages["x-default"] = absoluteUrl(DEFAULT_LOCALE, path);

    return LOCALES.map((locale) => ({
      url: absoluteUrl(locale, path),
      changeFrequency: "monthly" as const,
      priority: priorityOf(path),
      alternates: { languages },
    }));
  });
}
