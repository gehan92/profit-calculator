import type { Metadata } from "next";
import { openGraphImage } from "@/config/site";
import { DEFAULT_LOCALE, LOCALES, OPEN_GRAPH_LOCALE, type AppLocale } from "@/i18n/config";

/**
 * Search engine helpers (Part F4.5): every public page tells Google about
 * its English, Sinhala and Tamil versions, and which one is the default.
 */

/** "/profit-calculator" in Sinhala → "/si/profit-calculator"; home "/" → "/si". */
export function localizedPath(locale: AppLocale, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}

/**
 * `canonical` and `hreflang` links for one page.
 * Paths are relative; Next.js makes them absolute with `metadataBase`
 * (set in the [locale] layout from NEXT_PUBLIC_SITE_URL).
 */
export function languageAlternates(locale: AppLocale, path: string): Metadata["alternates"] {
  const languages: Record<string, string> = Object.fromEntries(
    LOCALES.map((language) => [language, localizedPath(language, path)]),
  );
  languages["x-default"] = localizedPath(DEFAULT_LOCALE, path);

  return { canonical: localizedPath(locale, path), languages };
}

interface PageSeo {
  locale: AppLocale;
  /** Path without the language, e.g. "/profit-calculator" or "/". */
  path: string;
  title: string;
  description: string;
  /** "Profit Calculator" in the page's language, shown on share previews. */
  siteName: string;
  /** Use the title as it is, without the " · Profit Calculator" ending (home page). */
  absoluteTitle?: boolean;
}

/**
 * Full metadata for a public page: title, description, language links and
 * the WhatsApp/Facebook preview text. The preview image comes from
 * `app/opengraph-image.tsx`.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  siteName,
  absoluteTitle = false,
}: PageSeo): Metadata {
  const image = {
    url: localizedPath(locale, openGraphImage.path),
    width: openGraphImage.width,
    height: openGraphImage.height,
    alt: openGraphImage.alt,
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: languageAlternates(locale, path),
    twitter: { card: "summary_large_image", title, description, images: [image] },
    // A page's openGraph replaces the layout's, so every field is set here.
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: localizedPath(locale, path),
      locale: OPEN_GRAPH_LOCALE[locale],
      alternateLocale: LOCALES.filter((other) => other !== locale).map(
        (other) => OPEN_GRAPH_LOCALE[other],
      ),
      // Listed again on purpose: a page's openGraph hides the image file of the folder above.
      images: [image],
    },
  };
}
