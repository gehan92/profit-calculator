"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AdminUserService, type UserActionError } from "@/lib/admin/admin-user-service";
import { authorizeAdmin } from "@/lib/admin/admin-guard";
import type { AdminPermission } from "@/lib/admin/admin-roles";
import { sendLoginLink } from "@/lib/admin/login-help";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * User actions in the admin panel (Part F4.2 `actions/admin/users.ts`).
 * Each one: validate → check the role (`authorizeAdmin`) → act with the
 * secret-key client → write an audit_log row → refresh the panel.
 */

export type AdminUserActionResult =
  | { ok: true; auditSaved: boolean }
  | { ok: false; error: UserActionError | "invalid" | "notAllowed" };

const userIdSchema = z.uuid();

async function run(
  permission: AdminPermission,
  userId: string,
  act: (service: AdminUserService) => ReturnType<AdminUserService["setBlocked"]>,
): Promise<AdminUserActionResult> {
  if (!userIdSchema.safeParse(userId).success) return { ok: false, error: "invalid" };

  const access = await authorizeAdmin(permission);
  if (!access.ok) return access;

  try {
    const service = new AdminUserService(createSupabaseAdminClient(), {
      id: access.user.id,
      email: access.user.email,
    });
    const result = await act(service);
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** Pauses an account (Admin only). */
export async function blockUser(userId: string): Promise<AdminUserActionResult> {
  return run("manageUsers", userId, (service) => service.setBlocked(userId, true));
}

/** Lets a paused account back in (Admin only). */
export async function unblockUser(userId: string): Promise<AdminUserActionResult> {
  return run("manageUsers", userId, (service) => service.setBlocked(userId, false));
}

/** Deletes an account and everything in it (Admin only). `typedEmail` must be the user's email. */
export async function deleteUser(userId: string, typedEmail: string): Promise<AdminUserActionResult> {
  if (typeof typedEmail !== "string") return { ok: false, error: "invalid" };
  return run("manageUsers", userId, (service) => service.deleteUser(userId, typedEmail));
}

/** Emails the user a new login link (Support and Admin). */
export async function sendLoginHelp(userId: string): Promise<AdminUserActionResult> {
  return run("sendLoginHelp", userId, (service) => service.sendLoginHelp(userId, sendLoginLink));
}
