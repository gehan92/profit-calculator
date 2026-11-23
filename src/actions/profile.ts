"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { AVATAR_BUCKET, isAvatarPath } from "@/lib/account/avatar";
import { removeAvatarFiles } from "@/lib/account/avatar-storage";
import { BillingRepository } from "@/lib/account/billing-repository";
import { buildMyDataExport, myDataFilename } from "@/lib/account/my-data";
import {
  notificationsSchema,
  profileNameSchema,
  regionSchema,
  type NotificationSettings,
  type RegionSettings,
} from "@/lib/account/profile";
import { ProfileRepository } from "@/lib/account/profile-repository";
import { authorize } from "@/lib/auth/authorize";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { BusinessRepository } from "@/lib/business/business-repository";
import { BUSINESS_TYPES } from "@/lib/business/business-types";
import { CategoryCatalog } from "@/lib/categories/category";
import { categoryNameOf } from "@/lib/categories/category-labels";
import { localIsoDate } from "@/lib/dates";
import { EntryRepository } from "@/lib/entries/entry-repository";
import { loadShopCatalog } from "@/lib/shop-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Account page Server Actions (spec D6): a person's own name, photo, language
 * and region, notification choices, signed-in devices, linked logins and the
 * download of their data. Each one finds the person from their login (never
 * from the request), changes only that person's own row, and answers `{ ok }`.
 * The database's column grants and Row Level Security check again.
 */

type Failure = "notLoggedIn" | "invalid" | "saveFailed";
export type SimpleResult = { ok: true } | { ok: false; error: Failure };

/** The logged-in person with their own database client, or `null` for a guest. */
async function ownerOfThisRequest() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  return { user, supabase, profiles: new ProfileRepository(supabase) };
}

/** Makes the Account page load fresh data on the next visit. */
function refreshAccount(): void {
  revalidatePath("/[locale]/account", "layout");
}

// -------------------------------------------------------------- saveProfileName

/** Account → Profile → name (at most 80 letters; empty removes it). */
export async function saveProfileName(name: string): Promise<SimpleResult> {
  const parsed = profileNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const me = await ownerOfThisRequest();
  if (!me) return { ok: false, error: "notLoggedIn" };

  try {
    await me.profiles.setName(me.user.id, parsed.data);
  } catch {
    return { ok: false, error: "saveFailed" };
  }
  refreshAccount();
  return { ok: true };
}

// ------------------------------------------------------------------- the photo

export type SaveAvatarResult = { ok: true; url: string } | { ok: false; error: Failure };

/**
 * Account → Profile → photo. The browser has already uploaded the small
 * picture to "<my id>/<random>.webp"; this checks it is really one of mine,
 * keeps its public address on the profile and removes every older picture.
 */
export async function saveAvatar(path: string): Promise<SaveAvatarResult> {
  const me = await ownerOfThisRequest();
  if (!me) return { ok: false, error: "notLoggedIn" };
  if (typeof path !== "string" || !isAvatarPath(path, me.user.id)) return { ok: false, error: "invalid" };

  try {
    const storage = me.supabase.storage.from(AVATAR_BUCKET);
    const { data: files, error } = await storage.list(me.user.id, { limit: 100 });
    // The file must really be there: the person uploaded it a moment ago.
    if (error || !files.some((file) => `${me.user.id}/${file.name}` === path)) return { ok: false, error: "invalid" };

    const { publicUrl } = storage.getPublicUrl(path).data;
    await me.profiles.setAvatarUrl(me.user.id, publicUrl);
    // The old picture is no longer needed; failing to remove it must not undo the change.
    await removeAvatarFiles(me.supabase, me.user.id, path).catch(() => undefined);

    refreshAccount();
    return { ok: true, url: publicUrl };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

/** Account → Profile → "Remove photo". */
export async function removeAvatar(): Promise<SimpleResult> {
  const me = await ownerOfThisRequest();
  if (!me) return { ok: false, error: "notLoggedIn" };

  try {
    await me.profiles.setAvatarUrl(me.user.id, null);
    await removeAvatarFiles(me.supabase, me.user.id).catch(() => undefined);
  } catch {
    return { ok: false, error: "saveFailed" };
  }
  refreshAccount();
  return { ok: true };
}

// ---------------------------------------------------------------- business type

const businessTypeSchema = z.enum(BUSINESS_TYPES);

/**
 * Account → Profile → business type (Owner only). The database adds that
 * type's default categories to the shop when it changes (migration 0007).
 */
export async function saveBusinessType(type: string): Promise<SimpleResult | { ok: false; error: "notAllowed" }> {
  const parsed = businessTypeSchema.safeParse(type);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const access = await authorize("editShop");
    if (!access.ok) return { ok: false, error: access.error };
    await new BusinessRepository(access.supabase).setBusinessType(access.membership.business.id, parsed.data);
  } catch {
    return { ok: false, error: "saveFailed" };
  }
  refreshAccount();
  return { ok: true };
}

// ----------------------------------------------------------- language and region

/** Account → Language & region: language, date format and the default currency for new shops. */
export async function saveRegion(input: RegionSettings): Promise<SimpleResult> {
  const parsed = regionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const me = await ownerOfThisRequest();
  if (!me) return { ok: false, error: "notLoggedIn" };

  try {
    await me.profiles.setRegion(me.user.id, parsed.data);
  } catch {
    return { ok: false, error: "saveFailed" };
  }
  refreshAccount();
  return { ok: true };
}

// ----------------------------------------------------------------- notifications

/** Account → Notifications: daily reminder (and its time), weekly summary, payment emails. */
export async function saveNotifications(input: NotificationSettings): Promise<SimpleResult> {
  const parsed = notificationsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const me = await ownerOfThisRequest();
  if (!me) return { ok: false, error: "notLoggedIn" };

  try {
    await me.profiles.setNotifications(me.user.id, parsed.data);
  } catch {
    return { ok: false, error: "saveFailed" };
  }
  refreshAccount();
  return { ok: true };
}

// ------------------------------------------------------------- login & security

/**
 * Account → Login & security → "Log out of all devices": ends every login of
 * this person, this device included. The page then goes to the home page
 * (a full page load, so nothing of the old session is left on screen).
 */
export async function logoutAllDevices(): Promise<SimpleResult> {
  const me = await ownerOfThisRequest();
  if (!me) return { ok: false, error: "notLoggedIn" };

  try {
    const { error } = await me.supabase.auth.signOut({ scope: "global" });
    if (error) return { ok: false, error: "saveFailed" };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
  return { ok: true };
}

export type UnlinkLoginResult = SimpleResult | { ok: false; error: "lastLogin" };

/**
 * Account → Login & security → remove a linked login (Google, email, phone).
 * The last remaining login can never be removed: the person would be locked out.
 */
export async function unlinkLogin(identityId: string): Promise<UnlinkLoginResult> {
  if (!z.string().min(1).max(100).safeParse(identityId).success) return { ok: false, error: "invalid" };

  const me = await ownerOfThisRequest();
  if (!me) return { ok: false, error: "notLoggedIn" };

  try {
    const { data, error } = await me.supabase.auth.getUserIdentities();
    if (error) return { ok: false, error: "saveFailed" };

    const identities = data.identities;
    if (identities.length < 2) return { ok: false, error: "lastLogin" };

    const target = identities.find((identity) => identity.identity_id === identityId);
    if (!target) return { ok: false, error: "invalid" };

    const removed = await me.supabase.auth.unlinkIdentity(target);
    if (removed.error) return { ok: false, error: "saveFailed" };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
  refreshAccount();
  return { ok: true };
}

// ----------------------------------------------------------------- my data (JSON)

export type ExportMyDataResult =
  | { ok: true; json: string; filename: string }
  | { ok: false; error: "invalid" | "notLoggedIn" | "failed" };

/**
 * Account → Privacy & data → "Download all my data (JSON)": the profile and
 * settings, the shop the person OWNS (categories, products, every record) and
 * their own billing. Staff and viewers get their profile and billing only: the
 * records belong to the shop's owner.
 */
export async function exportMyData(locale: string): Promise<ExportMyDataResult> {
  const parsedLocale = z.enum(LOCALES).safeParse(locale);
  if (!parsedLocale.success) return { ok: false, error: "invalid" };

  const user: CurrentUser | null = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };

  try {
    const supabase = await createSupabaseServerClient();
    const profiles = new ProfileRepository(supabase);
    const billing = new BillingRepository(supabase);
    const membership = await new BusinessRepository(supabase).findFirstMembership(user.id);

    const [profile, subscription, payments, accessLog] = await Promise.all([
      profiles.getAccountProfile(user.id),
      billing.currentSubscription(user.id),
      billing.payments(user.id),
      profiles.listAccessLog(),
    ]);

    const shops = [];
    if (membership?.role === "owner") {
      const { business } = membership;
      const [{ entries, truncated }, shop, tCategory] = await Promise.all([
        new EntryRepository(supabase).listAll(business.id),
        loadShopCatalog(supabase, business.id),
        getTranslations({ locale: parsedLocale.data, namespace: "categories" }),
      ]);
      const catalog = new CategoryCatalog(shop.categories, (key) => categoryNameOf(tCategory, key));
      shops.push({
        name: business.name,
        currency: business.currency,
        businessType: business.business_type,
        categories: shop.categories,
        products: shop.products,
        entries,
        categoryLabel: (entry: (typeof entries)[number]) => catalog.label(entry.category, entry.type),
        entriesTruncated: truncated,
      });
    }

    const data = buildMyDataExport({
      exportedAt: new Date(),
      account: { email: user.email },
      profile,
      shops,
      subscription,
      payments,
      supportAccessLog: accessLog,
    });
    return {
      ok: true,
      json: JSON.stringify(data, null, 2),
      filename: myDataFilename(localIsoDate(new Date())),
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
