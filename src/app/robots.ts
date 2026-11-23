import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * /robots.txt (Part F4.5): search engines may read every public page,
 * but never the private dashboard, the admin panel or the login callback.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = siteConfig.url.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // "/*/dashboard" covers /en/dashboard, /si/dashboard and /ta/dashboard (same for shop setup and the Account page).
      disallow: ["/*/dashboard", "/*/welcome", "/*/account", "/admin", "/auth/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
