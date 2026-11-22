"use server";

import { revalidatePath, updateTag } from "next/cache";
import { AdminRepository } from "@/lib/admin/admin-repository";
import { authorizeAdmin } from "@/lib/admin/admin-guard";
import { isSettingKey, settingSchemas } from "@/lib/admin/app-settings";
import { AuditLog } from "@/lib/admin/audit-log";
import { SETTINGS_CACHE_TAG } from "@/lib/platform/platform-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export type UpdateSettingResult =
  | { ok: true; auditSaved: boolean }
  | { ok: false; error: "invalid" | "notAllowed" | "failed" };

/**
 * Settings → saves one setting (Part D4, Part F4.2 `actions/admin/settings.ts`):
 * Admin only, checked against the rules for that key, saved through the Admin's
 * own login (RLS allows only admins), and always logged with the old and new
 * value.
 */
export async function updateSetting(key: string, value: unknown): Promise<UpdateSettingResult> {
  if (!isSettingKey(key)) return { ok: false, error: "invalid" };
  const parsed = settingSchemas[key].safeParse(value);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const access = await authorizeAdmin("changeSettings");
  if (!access.ok) return access;

  try {
    const repository = new AdminRepository(access.supabase);
    const before = (await repository.settings())[key];
    await repository.saveSetting(key, parsed.data, access.user.id);

    const auditSaved = await new AuditLog(createSupabaseAdminClient()).write({
      actorId: access.user.id,
      actorEmail: access.user.email,
      action: "settings.update",
      details: { key, from: before as Json, to: parsed.data as Json },
    });
    revalidatePath("/admin", "layout");
    // Every visitor's pages read the settings from a short-lived cache (maintenance banner,
    // support number): expire it so the change shows on their next page view.
    updateTag(SETTINGS_CACHE_TAG);
    return { ok: true, auditSaved };
  } catch {
    return { ok: false, error: "failed" };
  }
}
