import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * The web app manifest (Part F4.4): what the phone shows when the website is
 * added to the home screen. It starts at /dashboard; the proxy adds the
 * person's language, and sends someone who is not logged in to the login page.
 *
 * The name is the English one: the manifest is the same for every language.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Profit Calculator",
    short_name: "Profit",
    description: "Know your real profit in 10 seconds. Free tools for small shops.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: siteConfig.themeColor,
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
