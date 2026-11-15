/**
 * Website-wide settings. Values that change per environment come from
 * environment variables (Part F1); everything else lives here.
 */
export const siteConfig = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** WhatsApp number for the support button, digits only (e.g. 94XXXXXXXXX). */
  supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
  themeColor: "#0F766E",
} as const;

/** Public pages that are not calculators (Part C1.1). */
export const publicRoutes = {
  home: "/",
  tryMyBusiness: "/try",
  login: "/login",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
  feedback: "/feedback",
} as const;
