/**
 * Website-wide settings. Values that change per environment come from
 * environment variables (Part F1); everything else lives here.
 */
export const siteConfig = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** WhatsApp number for the support button, digits only (e.g. 94XXXXXXXXX). */
  supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
  themeColor: "#0F766E",
  /** Google Search Console "HTML tag" verification code (Part F4.5). Optional. */
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
} as const;

/**
 * The share-preview picture made by `app/[locale]/opengraph-image.tsx`.
 * Pages that set their own Open Graph data must list it again (see lib/seo.ts).
 */
export const openGraphImage = {
  /** Path without the language; served as /en/opengraph-image, /si/... */
  path: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Profit Calculator — know your real profit in 10 seconds. Free.",
} as const;

/** Full link to a page in one language, e.g. for WhatsApp share text. */
export function absoluteUrl(locale: string, path: string): string {
  const cleanPath = path === "/" ? "" : path;
  return `${siteConfig.url.replace(/\/$/, "")}/${locale}${cleanPath}`;
}

/** Public pages that are not calculators (Part C1.1). */
export const publicRoutes = {
  home: "/",
  tryMyBusiness: "/try",
  login: "/login",
  signup: "/signup",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
  feedback: "/feedback",
} as const;
