"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { ProfileRepository } from "@/lib/account/profile-repository";
import { isDeleteConfirmed } from "@/lib/account/delete-confirmation";
import { supportAccessEnd } from "@/lib/account/support-access";
import { authorize } from "@/lib/auth/authorize";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildEntriesCsv } from "@/lib/entries/entry-csv";
import { EntryRepository } from "@/lib/entries/entry-repository";
import { localIsoDate } from "@/lib/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Account Server Actions (Part F4.2 `actions/account.ts`): export the records
 * as CSV, switch support access, delete the account. Each one checks who is
 * asking first, then acts.
 */

const localeSchema = z.enum(LOCALES);

// ------------------------------------------------------------------ exportCsv

export type ExportCsvResult =
  | { ok: true; csv: string; filename: string; count: number; truncated: boolean }
  | { ok: false; error: "invalid" | "notLoggedIn" | "notAllowed" | "empty" | "failed" };

/**
 * Settings → "Download CSV": every record of the shop, oldest first, in the
 * person's language (Part D2). Owner only. The browser turns the text into a
 * file; nothing is stored on the server.
 */
export async function exportCsv(locale: string): Promise<ExportCsvResult> {
  const parsedLocale = localeSchema.safeParse(locale);
  if (!parsedLocale.success) return { ok: false, error: "invalid" };

  try {
    const access = await authorize("exportData");
    if (!access.ok) return { ok: false, error: access.error };

    const { entries, truncated } = await new EntryRepository(access.supabase).listAll(
      access.membership.business.id,
    );
    if (entries.length === 0) return { ok: false, error: "empty" };

    const [tColumns, tEntry, tCategory] = await Promise.all([
      getTranslations({ locale: parsedLocale.data, namespace: "settings.csvColumns" }),
      getTranslations({ locale: parsedLocale.data, namespace: "entry" }),
      getTranslations({ locale: parsedLocale.data, namespace: "categories" }),
    ]);
    const csv = buildEntriesCsv(entries, access.membership.business.currency, {
      columns: {
        date: tColumns("date"),
        type: tColumns("type"),
        category: tColumns("category"),
        amount: tColumns("amount"),
        currency: tColumns("currency"),
        note: tColumns("note"),
        addedAt: tColumns("addedAt"),
      },
      type: (type) => tEntry(type),
      category: (category) => tCategory(category),
    });

    return {
      ok: true,
      csv,
      filename: `profit-calculator-records-${localIsoDate(new Date())}.csv`,
      count: entries.length,
      truncated,
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}

// ----------------------------------------------------------- setSupportAccess

export type SetSupportAccessResult =
  | { ok: true; until: string | null }
  | { ok: false; error: "notLoggedIn" | "saveFailed" };

/**
 * Settings → support access switch (Part D2, 7 days): `true` lets the support
 * team see this person's records until 7 days from now, `false` ends it at
 * once. Any logged-in person can change their own switch.
 */
export async function setSupportAccess(enabled: boolean): Promise<SetSupportAccessResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };

  try {
    const supabase = await createSupabaseServerClient();
    const until = enabled ? supportAccessEnd() : null;
    await new ProfileRepository(supabase).setSupportAccessUntil(user.id, until);
    return { ok: true, until: until ? until.toISOString() : null };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

// --------------------------------------------------------------- recordActivity

/**
 * Marks the logged-in person as active (the admin Users list shows "last
 * active"). The database function itself writes at most once an hour, so
 * calling this often costs almost nothing. Failures are ignored: this must
 * never get in the way of using the app.
 */
export async function recordActivity(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("touch_last_active");
  } catch {
    // Nothing to do: "last active" is only for the admin's overview.
  }
}

// ---------------------------------------------------------------- deleteAccount

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "notLoggedIn" | "failed" };

/**
 * Settings → "Delete my account" (Part F3 schema notes): deletes the login
 * with the secret key; the database then removes the profile, shops, members
 * and entries in one go (they are tied to the login with ON DELETE CASCADE, and
 * the references that must survive are set to null, see migration 0002).
 *
 * The person must type DELETE, and only their OWN account is ever deleted:
 * the id comes from their login, never from the request. Their login cookies
 * are cleared afterwards.
 */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResult> {
  if (typeof confirmation !== "string" || !isDeleteConfirmed(confirmation)) {
    return { ok: false, error: "invalid" };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };

  try {
    const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(user.id);
    if (error) return { ok: false, error: "failed" };

    // The login no longer exists; remove its cookies from this browser.
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}
