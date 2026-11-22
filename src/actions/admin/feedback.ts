"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AdminRepository } from "@/lib/admin/admin-repository";
import { FEEDBACK_STATUSES } from "@/lib/admin/feedback-status";
import { authorizeAdmin } from "@/lib/admin/admin-guard";
import { AuditLog } from "@/lib/admin/audit-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SetFeedbackStatusResult =
  | { ok: true; auditSaved: boolean }
  | { ok: false; error: "invalid" | "notAllowed" | "notFound" | "failed" };

const schema = z.object({ id: z.uuid(), status: z.enum(FEEDBACK_STATUSES) });

/**
 * Feedback inbox → New / In progress / Done (Part D4): Support and Admin
 * (Part F4.2 `actions/admin/feedback.ts`). The change goes through the
 * person's own login, so Row Level Security decides again (`feedback_update`
 * is for the team only); the audit row is written with the secret key.
 */
export async function setFeedbackStatus(id: string, status: string): Promise<SetFeedbackStatusResult> {
  const parsed = schema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const access = await authorizeAdmin("updateFeedback");
  if (!access.ok) return access;

  try {
    const changed = await new AdminRepository(access.supabase).updateFeedbackStatus(
      parsed.data.id,
      parsed.data.status,
    );
    if (!changed) return { ok: false, error: "notFound" };

    const auditSaved = await new AuditLog(createSupabaseAdminClient()).write({
      actorId: access.user.id,
      actorEmail: access.user.email,
      action: "feedback.status",
      details: { feedback_id: parsed.data.id, status: parsed.data.status },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, auditSaved };
  } catch {
    return { ok: false, error: "failed" };
  }
}
