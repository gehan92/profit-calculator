import type { PlatformRole } from "@/lib/roles";

/**
 * Who an Admin may block or delete (Part D4 "User actions"). Two safety rules
 * the document implies but a mistake could break:
 * - never yourself (an Admin must not lock themselves out of the panel);
 * - never another Admin (Admin roles change only on the later Team screen).
 */
export type UserActionRefusal = "self" | "admin";

export function refuseUserAction(
  actorId: string,
  target: { id: string; platformRole: PlatformRole },
): UserActionRefusal | null {
  if (target.id === actorId) return "self";
  if (target.platformRole === "admin") return "admin";
  return null;
}

/**
 * "Type the email" / "type CONFIRM" boxes (Part C1.6): true when the typed
 * text is the expected text, ignoring spaces around it and capital letters
 * (an email is the same in any case).
 */
export function matchesTyped(typed: string, expected: string): boolean {
  const wanted = expected.trim().toLowerCase();
  return wanted !== "" && typed.trim().toLowerCase() === wanted;
}

/** The word typed to confirm dangerous settings changes such as maintenance mode. */
export const CONFIRM_WORD = "CONFIRM";
