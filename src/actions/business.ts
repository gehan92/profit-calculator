"use server";

import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { authorize } from "@/lib/auth/authorize";
import { BusinessRepository, SHOP_NAME_MAX_LENGTH } from "@/lib/business/business-repository";
import { BUSINESS_TYPES } from "@/lib/business/business-types";
import { refreshDashboard } from "@/lib/dashboard-cache";
import { isSupportedCurrency } from "@/lib/money";

// ------------------------------------------------------- completeShopSetup

export type CompleteShopSetupResult =
  | { ok: true }
  | {
      ok: false;
      error: "nameRequired" | "nameTooLong" | "invalid" | "notLoggedIn" | "notAllowed" | "saveFailed";
    };

const setupSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(SHOP_NAME_MAX_LENGTH, "nameTooLong"),
  businessType: z.enum(BUSINESS_TYPES),
  currency: z.string().refine(isSupportedCurrency, "invalid"),
  locale: z.enum(LOCALES),
});

/**
 * First-time shop setup (Part C1.7 "Set up your shop"): name, business type,
 * currency and language. Owner only; the shop is the Owner's own (found from
 * the login, never sent by the form) and RLS checks again.
 */
export async function completeShopSetup(input: {
  name: string;
  businessType: string;
  currency: string;
  locale: string;
}): Promise<CompleteShopSetupResult> {
  const parsed = setupSchema.safeParse(input);
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

    await new BusinessRepository(access.supabase).completeSetup(access.membership.business.id, parsed.data);
  } catch {
    return { ok: false, error: "saveFailed" };
  }

  refreshDashboard();
  return { ok: true };
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
