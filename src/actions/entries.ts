"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BusinessRepository, type Membership } from "@/lib/business/business-repository";
import {
  clientEntrySchema,
  entryFieldsSchema,
  IMPORT_BATCH_SIZE,
  latestEntryDate,
  type ClientEntry,
  type EntryFields,
} from "@/lib/entries/entry";
import { EntryQueryError, EntryRepository } from "@/lib/entries/entry-repository";
import { can, type Permission } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Entry Server Actions (Part F4.2). Each one: validate with zod â†’ get the
 * user from the Supabase session â†’ check the role â†’ write (RLS checks again)
 * â†’ refresh the dashboard â†’ return `{ ok, error? }`.
 */

/** Every dashboard page shows entries, so all of them are refreshed. */
function refreshDashboard(): void {
  revalidatePath("/[locale]/dashboard", "layout");
}

type Access =
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; membership: Membership }
  | { ok: false; error: "notLoggedIn" | "notAllowed" };

/** Loads the person's shop and role, and checks they may do `permission`. */
async function authorize(permission: Permission): Promise<Access> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };

  const supabase = await createSupabaseServerClient();
  const membership = await new BusinessRepository(supabase).findFirstMembership(user.id);
  if (!membership || !can(membership.role, permission)) return { ok: false, error: "notAllowed" };

  return { ok: true, supabase, membership };
}

// ------------------------------------------------------------------ addEntry

export type AddEntryResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "futureDate" | "notLoggedIn" | "notAllowed" | "saveFailed" };

const addEntrySchema = z.object({
  entry: entryFieldsSchema,
  /** Made in the browser for each save: a double tap or retry is stored once. */
  clientId: z.uuid(),
});

/** Add income / expense (Part D2 "Add entry"): Owner and Staff. */
export async function addEntry(entry: EntryFields, clientId: string): Promise<AddEntryResult> {
  const parsed = addEntrySchema.safeParse({ entry, clientId });
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.entry.entryDate > latestEntryDate()) return { ok: false, error: "futureDate" };

  try {
    const access = await authorize("addEntry");
    if (!access.ok) return { ok: false, error: access.error };

    await new EntryRepository(access.supabase).add(
      access.membership.business.id,
      parsed.data.entry,
      parsed.data.clientId,
    );
  } catch {
    return { ok: false, error: "saveFailed" };
  }

  refreshDashboard();
  return { ok: true };
}

// ------------------------------------------------- updateEntry / deleteEntry

export type ChangeEntryResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "futureDate" | "notLoggedIn" | "notAllowed" | "notFound" | "saveFailed";
    };

const entryIdSchema = z.uuid();
const updateEntrySchema = z.object({ id: entryIdSchema, entry: entryFieldsSchema });

/**
 * Change an entry (Part D2 edit sheet): Owner, and Staff for their own
 * entries from today. RLS decides which rows: an entry the person may not
 * change comes back as "not found / not allowed".
 */
export async function updateEntry(id: string, entry: EntryFields): Promise<ChangeEntryResult> {
  const parsed = updateEntrySchema.safeParse({ id, entry });
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.entry.entryDate > latestEntryDate()) return { ok: false, error: "futureDate" };

  try {
    const access = await authorize("editEntry");
    if (!access.ok) return { ok: false, error: access.error };

    const changed = await new EntryRepository(access.supabase).update(
      parsed.data.id,
      parsed.data.entry,
    );
    if (!changed) return { ok: false, error: "notFound" };
  } catch (error) {
    // Staff moving an entry to another day: the database says "not allowed".
    if (error instanceof EntryQueryError && error.isPermissionDenied) {
      return { ok: false, error: "notAllowed" };
    }
    return { ok: false, error: "saveFailed" };
  }

  refreshDashboard();
  return { ok: true };
}

/** Delete an entry: Owner only (Part B2). The screen asks to confirm and offers Undo before calling this. */
export async function deleteEntry(id: string): Promise<ChangeEntryResult> {
  if (!entryIdSchema.safeParse(id).success) return { ok: false, error: "invalid" };

  try {
    const access = await authorize("deleteEntry");
    if (!access.ok) return { ok: false, error: access.error };

    const deleted = await new EntryRepository(access.supabase).delete(id);
    if (!deleted) return { ok: false, error: "notFound" };
  } catch {
    return { ok: false, error: "saveFailed" };
  }

  refreshDashboard();
  return { ok: true };
}

// ------------------------------------------------------ syncOfflineEntries

export type SyncOfflineEntriesResult =
  | { ok: true; saved: string[]; refused: string[]; failed: string[] }
  | { ok: false; error: "invalid" | "notLoggedIn" | "notAllowed" | "saveFailed" };

/**
 * Sends entries added while offline (Part F4.4): Owner and Staff.
 *
 * Each entry is checked on its own and reported back by `clientId`:
 * `saved` (stored, or already stored by an earlier try), `refused` (will never
 * be accepted, so the phone may give up on it) or `failed` (try again later).
 * Sending the same entries twice therefore never stores anything twice.
 */
export async function syncOfflineEntries(
  entries: readonly ClientEntry[],
): Promise<SyncOfflineEntriesResult> {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > IMPORT_BATCH_SIZE) {
    return { ok: false, error: "invalid" };
  }

  const latest = latestEntryDate();
  const valid: ClientEntry[] = [];
  const refused: string[] = [];
  for (const item of entries) {
    const parsed = clientEntrySchema.safeParse(item);
    if (parsed.success && parsed.data.entryDate <= latest) valid.push(parsed.data);
    else if (typeof item?.clientId === "string") refused.push(item.clientId);
  }

  try {
    const access = await authorize("addEntry");
    if (!access.ok) return { ok: false, error: access.error };

    const outcome = await new EntryRepository(access.supabase).addQueued(
      access.membership.business.id,
      uniqueByClientId(valid),
    );
    if (outcome.saved.length > 0) refreshDashboard();
    return { ok: true, saved: outcome.saved, refused: [...refused, ...outcome.refused], failed: outcome.failed };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

// ---------------------------------------------------------- importGuestEntries

export type ImportGuestEntriesResult =
  | { ok: true; added: number; alreadySaved: number }
  | { ok: false; error: "invalid" | "notLoggedIn" | "notOwner" | "saveFailed" };

const importSchema = z
  .array(clientEntrySchema)
  .min(1)
  .max(IMPORT_BATCH_SIZE)
  // "No future dates" (Part F5).
  .refine((entries) => {
    const latest = latestEntryDate();
    return entries.every((entry) => entry.entryDate <= latest);
  });

/**
 * "Move N records to your account?" â†’ Yes (Part D2, Owner, first login).
 * Upserts on (business_id, client_id), so a retry never doubles anything.
 * The browser removes its copies only after `ok: true`.
 */
export async function importGuestEntries(
  entries: readonly ClientEntry[],
): Promise<ImportGuestEntriesResult> {
  const parsed = importSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const access = await authorize("importGuestEntries");
    if (!access.ok) {
      return { ok: false, error: access.error === "notAllowed" ? "notOwner" : access.error };
    }

    const outcome = await new EntryRepository(access.supabase).importClientEntries(
      access.membership.business.id,
      uniqueByClientId(parsed.data),
    );
    refreshDashboard();
    return { ok: true, ...outcome };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

/** The same entry twice in one request counts once. */
function uniqueByClientId(entries: readonly ClientEntry[]): ClientEntry[] {
  return [...new Map(entries.map((entry) => [entry.clientId, entry])).values()];
}
