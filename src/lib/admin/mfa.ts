import type { PlatformRole } from "@/lib/roles";
import { isTeamRole } from "./admin-roles";

/**
 * Two-step login for the team (Part F5 "Admin protection: MFA for admins").
 *
 * Everyone who can open the admin panel (Admin and Support) must log in with
 * a code from an authenticator app as well as the usual way. Supabase calls
 * the two levels "aal1" (one step, the normal login) and "aal2" (the code was
 * also entered).
 */

/** The only admin page a person without the code step may open. */
export const ADMIN_SECURITY_PATH = "/admin/security";

/** True for /admin/security (with or without a closing slash). */
export function isSecurityPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === ADMIN_SECURITY_PATH;
}

/** Supabase's "authenticator assurance level" of a login. */
export type AssuranceLevel = "aal1" | "aal2";

/** What a team member still has to do before the panel opens. */
export type MfaStep =
  /** Nothing: the code was entered (or the role needs no code). */
  | "done"
  /** No authenticator app is linked yet: scan the QR code. */
  | "enroll"
  /** An app is linked: type today's 6-digit code. */
  | "challenge";

/** Does this platform role have to use two-step login? */
export function mfaRequired(role: PlatformRole): boolean {
  return isTeamRole(role);
}

/** `level` is how this login was made; `hasFactor` says whether an authenticator app is linked. */
export function nextMfaStep(input: {
  role: PlatformRole;
  level: AssuranceLevel | null;
  hasFactor: boolean;
}): MfaStep {
  if (!mfaRequired(input.role)) return "done";
  if (input.level === "aal2") return "done";
  return input.hasFactor ? "challenge" : "enroll";
}

/** The 6-digit code from the authenticator app, as people type it ("123 456" is fine). */
export function cleanMfaCode(typed: string): string {
  return typed.replace(/\s+/g, "");
}

export function isValidMfaCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
