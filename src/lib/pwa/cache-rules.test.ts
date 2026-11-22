import { describe, expect, it } from "vitest";
import { classifyPath, localeOfPath, offlinePagePath, splitLocalePath } from "./cache-rules";

describe("classifyPath", () => {
  it.each([
    "/en",
    "/si",
    "/ta/profit-calculator",
    "/en/margin-calculator",
    "/en/selling-price-calculator",
    "/en/break-even-calculator",
    "/en/try",
    "/si/feedback",
    "/en/account-deleted",
  ])("keeps %s for everyone (public)", (path) => {
    expect(classifyPath(path)).toBe("public");
  });

  it.each(["/en/dashboard", "/si/dashboard/add", "/ta/dashboard/entries", "/en/dashboard/summary", "/en/paused"])(
    "treats %s as one person's data (private)",
    (path) => {
      expect(classifyPath(path)).toBe("private");
    },
  );

  it.each([
    "/admin",
    "/admin/users/123",
    "/auth/callback",
    "/api/anything",
    "/serwist/sw.js",
    "/_next/data/x.json",
    "/_vercel/insights/script.js",
    "/en/login",
    "/en/offline",
  ])("never keeps %s", (path) => {
    expect(classifyPath(path)).toBe("never");
  });

  it("does not mistake a similar name for a private page", () => {
    expect(classifyPath("/en/dashboards")).toBe("public");
    expect(classifyPath("/en/pausedness")).toBe("public");
  });
});

describe("splitLocalePath", () => {
  it("separates the language", () => {
    expect(splitLocalePath("/si/dashboard/add")).toEqual({ locale: "si", path: "/dashboard/add" });
    expect(splitLocalePath("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocalePath("/en/")).toEqual({ locale: "en", path: "/" });
    expect(splitLocalePath("/about")).toEqual({ locale: null, path: "/about" });
  });
});

describe("offline pages", () => {
  it("knows the language of an address and its offline page", () => {
    expect(localeOfPath("/ta/dashboard")).toBe("ta");
    expect(localeOfPath("/")).toBeNull();
    expect(offlinePagePath("si")).toBe("/si/offline");
  });
});
