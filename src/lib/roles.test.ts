import { describe, expect, it } from "vitest";
import { can, canOpen, dashboardRoutes, landing, MEMBER_ROLES, NAV } from "./roles";

/** Part F2 "Routes and access" table, one row per screen: [path, owner, staff, viewer]. */
const ROUTE_TABLE: [string, boolean, boolean, boolean][] = [
  ["/dashboard", true, true, false],
  ["/dashboard/add", true, true, false],
  ["/dashboard/entries", true, true, true],
  ["/dashboard/summary", true, false, true],
  ["/dashboard/products", true, false, false],
  ["/dashboard/settings", true, false, false],
  ["/dashboard/team", true, false, false],
];

describe("canOpen (Part F2 routes table)", () => {
  it.each(ROUTE_TABLE)("%s → owner %s, staff %s, viewer %s", (path, owner, staff, viewer) => {
    expect(canOpen("owner", path)).toBe(owner);
    expect(canOpen("staff", path)).toBe(staff);
    expect(canOpen("viewer", path)).toBe(viewer);
  });

  it("refuses unknown paths and look-alikes", () => {
    expect(canOpen("owner", "/dashboard/addx")).toBe(false);
    expect(canOpen("staff", "/dashboard/summary/2026-11")).toBe(false);
    expect(canOpen("owner", "/admin")).toBe(false);
  });
});

describe("landing", () => {
  it("sends Owner and Staff home and Viewers to the summary", () => {
    expect(landing("owner")).toBe("/dashboard");
    expect(landing("staff")).toBe("/dashboard");
    expect(landing("viewer")).toBe("/dashboard/summary");
  });

  it("is always a screen the role may open", () => {
    for (const role of MEMBER_ROLES) expect(canOpen(role, landing(role))).toBe(true);
  });
});

describe("NAV (Part C1 navigation by role)", () => {
  it("gives the Owner Home · Add · Summary · Settings", () => {
    expect(NAV.owner.map((item) => item.key)).toEqual(["home", "add", "summary", "settings"]);
  });

  it("only links to screens the role may open", () => {
    for (const role of MEMBER_ROLES) {
      for (const item of NAV[role]) expect(canOpen(role, item.href)).toBe(true);
    }
  });

  it("knows every route", () => {
    expect(Object.values(dashboardRoutes)).toHaveLength(7);
  });
});

describe("can (Part B2 permission matrix)", () => {
  it("lets Owner and Staff add entries, not Viewers", () => {
    expect(can("owner", "addEntry")).toBe(true);
    expect(can("staff", "addEntry")).toBe(true);
    expect(can("viewer", "addEntry")).toBe(false);
  });

  it("lets Owner and Staff edit entries, but only the Owner delete them (Part B2)", () => {
    expect(MEMBER_ROLES.filter((role) => can(role, "editEntry"))).toEqual(["owner", "staff"]);
    expect(MEMBER_ROLES.filter((role) => can(role, "deleteEntry"))).toEqual(["owner"]);
  });

  it("never shows totals to Staff", () => {
    expect(can("owner", "seeTotals")).toBe(true);
    expect(can("viewer", "seeTotals")).toBe(true);
    expect(can("staff", "seeTotals")).toBe(false);
  });

  it("lets only the Owner move guest records in", () => {
    expect(MEMBER_ROLES.filter((role) => can(role, "importGuestEntries"))).toEqual(["owner"]);
    // Settings: only the Owner changes the shop or downloads all records.
    expect(MEMBER_ROLES.filter((role) => can(role, "exportData"))).toEqual(["owner"]);
    expect(MEMBER_ROLES.filter((role) => can(role, "editShop"))).toEqual(["owner"]);
  });
});
