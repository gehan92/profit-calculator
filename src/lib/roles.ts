import type { Database } from "@/lib/supabase/types";

/**
 * Role rules in one place (Part F2 "lib/roles.ts", Part B2 permission matrix).
 *
 * Pages use it to build the menu and to send people away from screens their
 * role can't open; Server Actions use `can()` before writing. Row Level
 * Security in the database is always the final guard.
 */

/** Business roles inside one shop, exactly as the database enum. */
export type MemberRole = Database["public"]["Enums"]["member_role"];
export const MEMBER_ROLES = ["owner", "staff", "viewer"] as const satisfies readonly MemberRole[];

/** Website roles. */
export type PlatformRole = Database["public"]["Enums"]["platform_role"];

/** Every dashboard screen (paths without the language). */
export const dashboardRoutes = {
  home: "/dashboard",
  add: "/dashboard/add",
  entries: "/dashboard/entries",
  summary: "/dashboard/summary",
  products: "/dashboard/products",
  team: "/dashboard/team",
  settings: "/dashboard/settings",
} as const;

export type DashboardRoute = (typeof dashboardRoutes)[keyof typeof dashboardRoutes];

/** Label keys of the menu items ("appNav" in messages/*.json). */
export type NavKey = "home" | "add" | "summary" | "settings" | "today" | "myEntries" | "entries";

export interface NavItem {
  href: DashboardRoute;
  key: NavKey;
}

/** Phone bottom tabs / laptop sidebar per role (Part C1 "Navigation by role"). */
export const NAV: Record<MemberRole, readonly NavItem[]> = {
  owner: [
    { href: dashboardRoutes.home, key: "home" },
    { href: dashboardRoutes.add, key: "add" },
    { href: dashboardRoutes.summary, key: "summary" },
    { href: dashboardRoutes.settings, key: "settings" },
  ],
  staff: [
    { href: dashboardRoutes.home, key: "today" },
    { href: dashboardRoutes.add, key: "add" },
    { href: dashboardRoutes.entries, key: "myEntries" },
  ],
  viewer: [
    { href: dashboardRoutes.summary, key: "summary" },
    { href: dashboardRoutes.entries, key: "entries" },
  ],
};

/** Screens each role may open (Part F2 "Routes and access"). */
const ALLOWED: Record<MemberRole, readonly DashboardRoute[]> = {
  owner: Object.values(dashboardRoutes),
  staff: [dashboardRoutes.home, dashboardRoutes.add, dashboardRoutes.entries],
  viewer: [dashboardRoutes.summary, dashboardRoutes.entries],
};

/** True if this role may open this dashboard screen. Exact paths only. */
export function canOpen(role: MemberRole, path: string): boolean {
  return (ALLOWED[role] as readonly string[]).includes(path);
}

/** Where a role lands after login (Part C1): Viewers start on the summary. */
export function landing(role: MemberRole): DashboardRoute {
  return role === "viewer" ? dashboardRoutes.summary : dashboardRoutes.home;
}

/**
 * What each role may do with a shop's data (Part B2). Only the actions the
 * app checks in code are listed; RLS enforces the same rules in the database.
 */
const PERMISSIONS = {
  /** Add income / expense. */
  addEntry: ["owner", "staff"],
  /** Change an entry (Staff: their own, from today; RLS enforces which). */
  editEntry: ["owner", "staff"],
  /** Delete an entry (Part B2: Owner only). */
  deleteEntry: ["owner"],
  /** Today's profit, monthly summary, real profit. Staff never see totals (Part B3). */
  seeTotals: ["owner", "viewer"],
  /** "Move N records to your account?" after the first login. */
  importGuestEntries: ["owner"],
} as const satisfies Record<string, readonly MemberRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: MemberRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly MemberRole[]).includes(role);
}
