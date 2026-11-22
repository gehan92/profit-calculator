import { describe, expect, it } from "vitest";
import {
  ADMIN_HIDDEN_PATH,
  afterLoginPath,
  dashboardPath,
  isAdminPath,
  isEntryPath,
  isLoginPath,
  isProtectedPath,
  isSignupPath,
  isTryPath,
  loginPath,
  safeNextPath,
  signupPath,
  splitLocale,
  welcomePath,
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

  it("protects the shop setup page too (only logged-in people set up a shop)", () => {
    expect(isProtectedPath("/welcome")).toBe(true);
  });

  it("leaves public pages open", () => {
    for (const path of ["/", "/profit-calculator", "/try", "/login", "/signup", "/dashboards", "/welcomes"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });
});

describe("isLoginPath, isSignupPath and isEntryPath", () => {
  it("matches only the login page", () => {
    expect(isLoginPath("/login")).toBe(true);
    expect(isLoginPath("/login-help")).toBe(false);
    expect(isLoginPath("/signup")).toBe(false);
  });

  it("matches only the Create free account page", () => {
    expect(isSignupPath("/signup")).toBe(true);
    expect(isSignupPath("/signup-now")).toBe(false);
    expect(isSignupPath("/login")).toBe(false);
  });

  it("treats both as pages a logged-in person never sees", () => {
    expect(isEntryPath("/login")).toBe(true);
    expect(isEntryPath("/signup")).toBe(true);
    expect(isEntryPath("/dashboard")).toBe(false);
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

describe("signupPath and welcomePath", () => {
  it("builds language-prefixed paths", () => {
    expect(signupPath("en")).toBe("/en/signup");
    expect(signupPath("ta", "/ta/dashboard/add")).toBe("/ta/signup?next=%2Fta%2Fdashboard%2Fadd");
    expect(welcomePath("si")).toBe("/si/welcome");
    expect(welcomePath("si", "google")).toBe("/si/welcome?method=google");
  });
});

describe("afterLoginPath (Part C1.7: no dead ends)", () => {
  const base = { locale: "en" as const, method: "email" as const, next: "/en/dashboard" };

  it("sends a brand-new account to shop setup, from Log in or Create free account alike", () => {
    expect(afterLoginPath({ ...base, created: true, fromSignup: false })).toBe("/en/welcome?method=email");
    expect(afterLoginPath({ ...base, created: true, fromSignup: true, method: "google" })).toBe(
      "/en/welcome?method=google",
    );
  });

  it("logs an existing account in and says 'Welcome back' when they used Create free account", () => {
    expect(afterLoginPath({ ...base, created: false, fromSignup: true })).toBe("/en/dashboard?back=1");
    expect(afterLoginPath({ ...base, created: false, fromSignup: true, next: "/si/dashboard/summary?month=2026-11" })).toBe(
      "/si/dashboard/summary?month=2026-11&back=1",
    );
  });

  it("takes an existing account to where it was going, with no extra message", () => {
    expect(afterLoginPath({ ...base, created: false, fromSignup: false })).toBe("/en/dashboard");
    expect(afterLoginPath({ ...base, created: false, fromSignup: false, next: "/ta/dashboard/add" })).toBe(
      "/ta/dashboard/add",
    );
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
