import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformRole } from "@/lib/roles";
import { removeAvatarFiles } from "@/lib/account/avatar-storage";
import type { Database } from "@/lib/supabase/types";
import { AuditLog } from "./audit-log";
import { maskEmail } from "./mask";
import { matchesTyped, refuseUserAction } from "./user-rules";

export type UserActionError =
  | "notFound"
  | "self"
  | "admin"
  | "emailMismatch"
  | "noEmail"
  | "failed";

/** `auditSaved: false` means the action worked but its log row could not be saved. */
export type UserActionResult = { ok: true; auditSaved: boolean } | { ok: false; error: UserActionError };

/** Sends a login link to an email address (Support's "login help"). */
export type SendLoginLink = (email: string) => Promise<boolean>;

interface Target {
  id: string;
  email: string | null;
  fullName: string | null;
  platformRole: PlatformRole;
}

/**
 * What an Admin does to another user (Part D4 "User actions"): block, unblock,
 * delete (typing their email) and send login help. Every action writes an
 * `audit_log` row (Part B3).
 *
 * It works with the SECRET-key client, which skips Row Level Security, so
 * the caller must already have checked the role (`authorizeAdmin`). Two
 * safety rules are enforced here as well: never yourself, never another Admin
 * (see `refuseUserAction`).
 */
export class AdminUserService {
  private readonly audit: AuditLog;

  constructor(
    private readonly admin: SupabaseClient<Database>,
    private readonly actor: { id: string; email: string | null },
  ) {
    this.audit = new AuditLog(admin);
  }

  /** Pauses an account ("Your account is paused" screen, Part C2) or lets it back in. */
  async setBlocked(targetId: string, blocked: boolean): Promise<UserActionResult> {
    const target = await this.load(targetId);
    if (!target) return { ok: false, error: "notFound" };
    const refusal = refuseUserAction(this.actor.id, target);
    if (refusal) return { ok: false, error: refusal };

    const { data, error } = await this.admin
      .from("profiles")
      .update({ status: blocked ? "blocked" : "active" })
      .eq("id", targetId)
      .select("id");
    if (error || data.length === 0) return { ok: false, error: "failed" };

    return this.logged(blocked ? "user.block" : "user.unblock", target);
  }

  /**
   * Deletes the login and, through the database's cascade rules, the profile,
   * shops, members and entries (Part F3 schema notes, migration 0002), plus the
   * profile photo files in Storage (they are not tied to the login). The
   * Admin must type the user's email exactly (Part C1.6).
   */
  async deleteUser(targetId: string, typedEmail: string): Promise<UserActionResult> {
    const target = await this.load(targetId);
    if (!target) return { ok: false, error: "notFound" };
    const refusal = refuseUserAction(this.actor.id, target);
    if (refusal) return { ok: false, error: refusal };
    if (!target.email || !matchesTyped(typedEmail, target.email)) return { ok: false, error: "emailMismatch" };

    // Profile photos are not tied to the login, so they would stay behind: remove them first.
    // If that fails nothing is deleted yet and the Admin can simply try again.
    try {
      await removeAvatarFiles(this.admin, targetId);
    } catch {
      return { ok: false, error: "failed" };
    }

    const { error } = await this.admin.auth.admin.deleteUser(targetId);
    if (error) return { ok: false, error: "failed" };

    return this.logged("user.delete", target);
  }

  /** Sends the user a fresh login link by email. Open to Support as well as Admin. */
  async sendLoginHelp(targetId: string, send: SendLoginLink): Promise<UserActionResult> {
    const target = await this.load(targetId);
    if (!target) return { ok: false, error: "notFound" };
    if (!target.email) return { ok: false, error: "noEmail" };
    if (!(await send(target.email))) return { ok: false, error: "failed" };

    return this.logged("user.login_help", target);
  }

  private async load(id: string): Promise<Target | null> {
    const { data: profile } = await this.admin
      .from("profiles")
      .select("id, full_name, platform_role")
      .eq("id", id)
      .maybeSingle();
    if (!profile) return null;

    const { data: account } = await this.admin.auth.admin.getUserById(id);
    return {
      id: profile.id,
      email: account.user?.email ?? null,
      fullName: profile.full_name,
      platformRole: profile.platform_role,
    };
  }

  private async logged(
    action: "user.block" | "user.unblock" | "user.delete" | "user.login_help",
    target: Target,
  ): Promise<UserActionResult> {
    const auditSaved = await this.audit.write({
      actorId: this.actor.id,
      actorEmail: this.actor.email,
      action,
      targetUserId: target.id,
      // Masked, like everywhere an admin sees a user (Part B4); the id says who it was.
      details: { email: maskEmail(target.email) },
    });
    return { ok: true, auditSaved };
  }
}
