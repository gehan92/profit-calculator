"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { authorize } from "@/lib/auth/authorize";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dashboardPath } from "@/lib/auth/routes";
import { BusinessRepository, SHOP_NAME_MAX_LENGTH } from "@/lib/business/business-repository";
import { refreshDashboard } from "@/lib/dashboard-cache";
import { isSupportedCurrency } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Result shape every action returns (Part F4.2): `ok`, or an error key for the UI. */
export type RenameShopResult =
  | { ok: true }
  | { ok: false; error: "nameRequired" | "nameTooLong" | "saveFailed" };

const renameSchema = z.object({
  /** Sent by the form: Server Actions cannot read the language from the address. */
  locale: z.enum(LOCALES),
  businessId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "nameRequired")
    .max(SHOP_NAME_MAX_LENGTH, "nameTooLong"),
});

/**
 * Sets the shop name (first-login question, Part D2; later also Settings).
 * Validate with zod → check the user → write (RLS allows only the Owner).
 */
export async function renameShop(
  _previous: RenameShopResult | null,
  formData: FormData,
): Promise<RenameShopResult> {
  const parsed = renameSchema.safeParse({
    locale: formData.get("locale"),
    businessId: formData.get("businessId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { ok: false, error: message === "nameTooLong" ? "nameTooLong" : "nameRequired" };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "saveFailed" };

  try {
    const supabase = await createSupabaseServerClient();
    await new BusinessRepository(supabase).rename(parsed.data.businessId, parsed.data.name);
  } catch {
    return { ok: false, error: "saveFailed" };
  }

  // Back to the dashboard without "?welcome=", so the question is not asked again.
  redirect(dashboardPath(parsed.data.locale));
}

// ------------------------------------------------------- updateShopSettings

export type UpdateShopSettingsResult =
  | { ok: true }
  | {
      ok: false;
      error: "nameRequired" | "nameTooLong" | "invalid" | "notLoggedIn" | "notAllowed" | "saveFailed";
    };

const settingsSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(SHOP_NAME_MAX_LENGTH, "nameTooLong"),
  currency: z.string().refine(isSupportedCurrency, "invalid"),
  locale: z.enum(LOCALES),
});

/**
 * Settings → shop name, currency and language (Part D2): Owner only.
 * The shop is the Owner's own (found from the login, never sent by the form),
 * and RLS checks again.
 */
export async function updateShopSettings(input: {
  name: string;
  currency: string;
  locale: string;
}): Promise<UpdateShopSettingsResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return {
      ok: false,
      error: message === "nameRequired" || message === "nameTooLong" ? message : "invalid",
    };
  }

  try {
    const access = await authorize("editShop");
    if (!access.ok) return { ok: false, error: access.error };

    await new BusinessRepository(access.supabase).updateSettings(
      access.membership.business.id,
      parsed.data,
    );
  } catch {
    return { ok: false, error: "saveFailed" };
  }

  refreshDashboard();
  return { ok: true };
}
