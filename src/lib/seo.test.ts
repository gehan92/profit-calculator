import { describe, expect, it } from "vitest";
import { languageAlternates, localizedPath, pageMetadata } from "./seo";

describe("localizedPath", () => {
  it("adds the language in front of the path", () => {
    expect(localizedPath("si", "/profit-calculator")).toBe("/si/profit-calculator");
  });

  it("uses /en (not /en/) for the home page", () => {
    expect(localizedPath("en", "/")).toBe("/en");
  });
});

describe("languageAlternates (hreflang, Part F4.5)", () => {
  it("links all three languages and makes English the default", () => {
    expect(languageAlternates("ta", "/margin-calculator")).toEqual({
      canonical: "/ta/margin-calculator",
      languages: {
        en: "/en/margin-calculator",
        si: "/si/margin-calculator",
        ta: "/ta/margin-calculator",
        "x-default": "/en/margin-calculator",
      },
    });
  });
});

describe("pageMetadata", () => {
  it("gives the preview the page's own language and lists the others", () => {
    const metadata = pageMetadata({
      locale: "si",
      path: "/",
      title: "T",
      description: "D",
      siteName: "S",
    });
    expect(metadata.openGraph).toMatchObject({
      siteName: "S",
      locale: "si_LK",
      alternateLocale: ["en_LK", "ta_LK"],
      url: "/si",
      images: [{ url: "/si/opengraph-image", width: 1200, height: 630 }],
    });
  });

  it("always includes the preview image for WhatsApp, Facebook and X", () => {
    const metadata = pageMetadata({
      locale: "en",
      path: "/profit-calculator",
      title: "T",
      description: "D",
      siteName: "S",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ url: "/en/opengraph-image" }],
    });
  });
});
