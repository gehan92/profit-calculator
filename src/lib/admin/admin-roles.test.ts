import { describe, expect, it } from "vitest";
import type { PlatformRole } from "@/lib/roles";
import { ADMIN_NAV, adminLanding, adminRoutes, canAdmin, canOpenAdminPath, isTeamRole } from "./admin-roles";

const ROLES: PlatformRole[] = ["user", "support", "admin"];

describe("admin permissions (Part B2)", () => {
  it("lets Admin do everything", () => {
    for (const permission of [
      "viewStats", "viewUsers", "manageUsers", "sendLoginHelp",
      "viewFeedback", "updateFeedback", "viewAudit", "changeSettings",
    ] as const) {
      expect(canAdmin("admin", permission)).toBe(true);
    }
  });

  it("lets Support only look at users and feedback, change feedback status and send login help", () => {
    expect(ROLES.filter((role) => canAdmin(role, "viewUsers"))).toEqual(["support", "admin"]);
    expect(ROLES.filter((role) => canAdmin(role, "viewFeedback"))).toEqual(["support", "admin"]);
    expect(ROLES.filter((role) => canAdmin(role, "updateFeedback"))).toEqual(["support", "admin"]);
    expect(ROLES.filter((role) => canAdmin(role, "sendLoginHelp"))).toEqual(["support", "admin"]);

    for (const permission of ["viewStats", "manageUsers", "viewAudit", "changeSettings"] as const) {
      expect(ROLES.filter((role) => canAdmin(role, permission))).toEqual(["admin"]);
    }
  });

  it("gives an ordinary user nothing", () => {
    expect(canAdmin("user", "viewUsers")).toBe(false);
    expect(isTeamRole("user")).toBe(false);
    expect(isTeamRole("support")).toBe(true);
    expect(isTeamRole("admin")).toBe(true);
  });
});

describe("canOpenAdminPath: the Part F2 routes table", () => {
  const paths = ["/admin", "/admin/users", "/admin/users/abc-123", "/admin/feedback", "/admin/audit", "/admin/settings", "/admin/security", "/admin/content", "/admin/nope"];

  it("Admin may open everything (an unknown page is then Next.js's own 404)", () => {
    for (const path of paths) expect(canOpenAdminPath("admin", path)).toBe(true);
  });

  it("an ordinary user and a guest get a 404 on every admin path (the panel is not revealed)", () => {
    for (const path of paths) expect(canOpenAdminPath("user", path)).toBe(false);
  });

  it("Support: /admin (which leads to Users), Users, one user, Feedback and Security (two-step login); 404 for the rest", () => {
    const allowed = paths.filter((path) => canOpenAdminPath("support", path));
    expect(allowed).toEqual(["/admin", "/admin/users", "/admin/users/abc-123", "/admin/feedback", "/admin/security"]);
  });

  it("ignores a trailing slash and does not confuse similar names", () => {
    expect(canOpenAdminPath("support", "/admin/users/")).toBe(true);
    expect(canOpenAdminPath("support", "/admin/")).toBe(true);
    expect(canOpenAdminPath("support", "/admin/usersX")).toBe(false);
    expect(canOpenAdminPath("support", "/admin/feedback/extra")).toBe(false);
    expect(canOpenAdminPath("support", "/admin/settings")).toBe(false);
  });
});

describe("landing and menu", () => {
  it("sends Admin to the dashboard and Support to the user list", () => {
    expect(adminLanding("admin")).toBe(adminRoutes.dashboard);
    expect(adminLanding("support")).toBe(adminRoutes.users);
  });

  it("builds each role's sidebar from the permissions", () => {
    const menu = (role: PlatformRole) => ADMIN_NAV.filter((item) => canAdmin(role, item.permission)).map((item) => item.label);
    expect(menu("admin")).toEqual(["Dashboard", "Users", "Feedback", "Audit log", "Settings", "Security"]);
    expect(menu("support")).toEqual(["Users", "Feedback", "Security"]);
    expect(menu("user")).toEqual([]);
  });

  it("every menu link is a page this role may open", () => {
    for (const role of ["support", "admin"] as const) {
      for (const item of ADMIN_NAV.filter((entry) => canAdmin(role, entry.permission))) {
        expect(canOpenAdminPath(role, item.href)).toBe(true);
      }
    }
  });
});
