import type { PlatformRole } from "@/lib/roles";

/**
 * Who may do what in the admin panel (Part B2 permission matrix, Part C1.5–C1.6,
 * Part D4, Part F2 routes table). Like `lib/roles.ts` for shops: pages and Server
 * Actions use it, and the database (RLS and the admin_* functions) checks again.
 *
 * Admin: everything. Support: the Users list and detail and the Feedback inbox,
 * plus "login help"; no stats, no block/delete, no settings, no audit log.
 * Everyone else (and anyone blocked) gets a 404, so the admin panel's
 * existence is never revealed.
 */

/** Every admin screen (paths are outside `[locale]`: the panel is English only). */
export const adminRoutes = {
  dashboard: "/admin",
  users: "/admin/users",
  feedback: "/admin/feedback",
  audit: "/admin/audit",
  settings: "/admin/settings",
  /** Two-step login: the one page open before the code step is done (see mfa.ts). */
  security: "/admin/security",
} as const;

const ADMIN_ONLY = ["admin"] as const;
const TEAM = ["support", "admin"] as const;

/** What each platform role may do. */
const PERMISSIONS = {
  /** The dashboard totals (admin_stats). */
  viewStats: ADMIN_ONLY,
  /** The user list and one user's account info (counts only, never money). */
  viewUsers: TEAM,
  /** Block, unblock and delete a user. */
  manageUsers: ADMIN_ONLY,
  /** Send a user a fresh login link (Support's only user action). */
  sendLoginHelp: TEAM,
  viewFeedback: TEAM,
  /** New / In progress / Done. */
  updateFeedback: TEAM,
  viewAudit: ADMIN_ONLY,
  /** Maintenance mode, feature flags, limits, defaults, support number. */
  changeSettings: ADMIN_ONLY,
  /** Set up or check the authenticator app (two-step login). */
  manageSecurity: TEAM,
} as const satisfies Record<string, readonly PlatformRole[]>;

export type AdminPermission = keyof typeof PERMISSIONS;

export function canAdmin(role: PlatformRole, permission: AdminPermission): boolean {
  return (PERMISSIONS[permission] as readonly PlatformRole[]).includes(role);
}

/** Support or Admin: someone who may open the admin panel at all. */
export function isTeamRole(role: PlatformRole): boolean {
  return role === "support" || role === "admin";
}

/** The permission a screen needs, from its path (`/admin/users/<id>` counts as Users). */
function permissionForPath(path: string): AdminPermission | null {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === adminRoutes.dashboard) return "viewStats";
  if (clean === adminRoutes.users || clean.startsWith(`${adminRoutes.users}/`)) return "viewUsers";
  if (clean === adminRoutes.feedback) return "viewFeedback";
  if (clean === adminRoutes.audit) return "viewAudit";
  if (clean === adminRoutes.settings) return "changeSettings";
  if (clean === adminRoutes.security) return "manageSecurity";
  return null;
}

/**
 * True if this role may open this /admin path (Part F2: "Other /admin/*: 404
 * for everyone but Admin"). Admin always passes: a path that does not exist
 * is then a normal 404 from Next.js. Support passes only on their screens.
 * `/admin` itself is open to Support, and sends them on to the Users list.
 */
export function canOpenAdminPath(role: PlatformRole, path: string): boolean {
  if (role === "admin") return true;
  if (role !== "support") return false;
  if (path.replace(/\/+$/, "") === adminRoutes.dashboard) return true;

  const permission = permissionForPath(path);
  return permission !== null && canAdmin(role, permission);
}

/** Where `/admin` leads: the dashboard for Admin, the Users list for Support (Part F2). */
export function adminLanding(role: PlatformRole): string {
  return role === "admin" ? adminRoutes.dashboard : adminRoutes.users;
}

export interface AdminNavItem {
  href: string;
  label: string;
  permission: AdminPermission;
}

/** The sidebar, in the order of Part C1 "Navigation by role". Screens that ship later are not listed. */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: adminRoutes.dashboard, label: "Dashboard", permission: "viewStats" },
  { href: adminRoutes.users, label: "Users", permission: "viewUsers" },
  { href: adminRoutes.feedback, label: "Feedback", permission: "viewFeedback" },
  { href: adminRoutes.audit, label: "Audit log", permission: "viewAudit" },
  { href: adminRoutes.settings, label: "Settings", permission: "changeSettings" },
  { href: adminRoutes.security, label: "Security", permission: "manageSecurity" },
];
