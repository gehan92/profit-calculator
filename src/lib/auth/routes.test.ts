import { describe, expect, it } from "vitest";
import {
  ADMIN_HIDDEN_PATH,
  dashboardPath,
  isAdminPath,
  isLoginPath,
  isProtectedPath,
  isTryPath,
  loginPath,
  safeNextPath,
  splitLocale,
} from "./routes";

describe("splitLocale", () => {
  it.each([
    ["/si/dashboard/add", "si", "/dashboard/add"],
    ["/en", "en", "/"],
    ["/ta/", "ta", "/"],
    ["/en/login", "en", "/login"],
  ])("%s → %s + %s", (pathname, locale, path) => {
    expect(splitLocale(pathname)).toEqual({ locale, path });
  });

  it("returns no language for paths outside [locale]", () => {
    expect(splitLocale("/auth/callback")).toEqual({ locale: null, path: "/auth/callback" });
  });
});

describe("isProtectedPath (Part C1: not logged in → login)", () => {
  it("protects the dashboard and everything under it", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/summary")).toBe(true);
  });

  it("leaves public pages open", () => {
    for (const path of ["/", "/profit-calculator", "/try", "/login", "/dashboards"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });
});

describe("isLoginPath", () => {
  it("matches only the login page", () => {
    expect(isLoginPath("/login")).toBe(true);
    expect(isLoginPath("/login-help")).toBe(false);
  });
});

describe("isTryPath", () => {
  it("matches only guest My Business", () => {
    expect(isTryPath("/try")).toBe(true);
    expect(isTryPath("/trying")).toBe(false);
    expect(isTryPath("/dashboard")).toBe(false);
  });
});

describe("safeNextPath (no open redirects)", () => {
  const fallback = "/en/dashboard";

  it("keeps paths on this website, with their query", () => {
    expect(safeNextPath("/si/dashboard/summary?month=2026-11", fallback)).toBe(
      "/si/dashboard/summary?month=2026-11",
    );
  });

  it.each([
    null,
    "",
    "https://evil.example/steal",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
  ])("refuses %j", (value) => {
    expect(safeNextPath(value, fallback)).toBe(fallback);
  });
});

describe("dashboardPath and loginPath", () => {
  it("builds language-prefixed paths", () => {
    expect(dashboardPath("ta")).toBe("/ta/dashboard");
    expect(dashboardPath()).toBe("/en/dashboard");
    expect(loginPath("si", "/si/dashboard")).toBe("/si/login?next=%2Fsi%2Fdashboard");
    expect(loginPath("en")).toBe("/en/login");
  });
});

describe("isAdminPath", () => {
  it.each(["/admin", "/admin/", "/admin/users", "/admin/users/abc"])("%s is an admin path", (path) => {
    expect(isAdminPath(path)).toBe(true);
  });

  it.each(["/", "/en/admin", "/administrator", "/adminx/users", "/en/dashboard", "/auth/callback"])(
    "%s is not",
    (path) => {
      expect(isAdminPath(path)).toBe(false);
    },
  );

  it("hides the panel behind an address that does not exist, in the default language", () => {
    expect(ADMIN_HIDDEN_PATH).toBe("/en/page-not-found");
    expect(splitLocale(ADMIN_HIDDEN_PATH)).toEqual({ locale: "en", path: "/page-not-found" });
  });
});
