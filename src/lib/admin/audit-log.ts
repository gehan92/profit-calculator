import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

/**
 * Every admin/support action is recorded (Part B3, Part D4 Audit log). The
 * names below are the `action` column; the audit page filters by them.
 */
export const AUDIT_ACTIONS = [
  "user.block",
  "user.unblock",
  "user.delete",
  "user.login_help",
  "feedback.status",
  "settings.update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  actorId: string;
  actorEmail: string | null;
  action: AuditAction;
  /** The user the action was about, when there is one. Not a foreign key, so it outlives a deleted user. */
  targetUserId?: string;
  /** Short facts such as the target's email or the old and new value. Never a shop's money. */
  details?: Record<string, Json>;
}

/**
 * Writes the audit log. Nobody can insert into `audit_log` with a normal
 * login (there is no insert policy, on purpose), so it is given the
 * secret-key client (made in lib/supabase/admin.ts, server only) by admin code.
 *
 * The actor's email is stored inside `details`, so the log still reads well
 * after an account is deleted (the `actor_id` link is then cleared).
 */
export class AuditLog {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Returns `false` when the row could not be saved (the caller then warns the admin). */
  async write(entry: AuditEntry): Promise<boolean> {
    const { error } = await this.db.from("audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      details: { actor_email: entry.actorEmail, ...entry.details },
    });

    if (error) {
      console.error("Could not write the audit log:", error.message);
      return false;
    }
    return true;
  }
}
