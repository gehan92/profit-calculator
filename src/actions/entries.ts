"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BusinessRepository } from "@/lib/business/business-repository";
import {
  clientEntrySchema,
  entryFieldsSchema,
  IMPORT_BATCH_SIZE,
  latestEntryDate,
  type ClientEntry,
  type EntryFields,
} from "@/lib/entries/entry";
import { EntryRepository } from "@/lib/entries/entry-repository";
import { can } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Entry Server Actions (Part F4.2). Each one: validate with zod → get the
 * user from the Supabase session → check the role → write (RLS checks again)
 * → refresh the dashboard → return `{ ok, error? }`.
 */

/** Every dashboard page shows entries, so all of them are refreshed. */
function refreshDashboard(): void {
  revalidatePath("/[locale]/dashboard", "layout");
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

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };

  try {
    const supabase = await createSupabaseServerClient();
    const membership = await new BusinessRepository(supabase).findFirstMembership(user.id);
    if (!membership || !can(membership.role, "addEntry")) return { ok: false, error: "notAllowed" };

    await new EntryRepository(supabase).add(
      membership.business.id,
      parsed.data.entry,
      parsed.data.clientId,
    );
  } catch {
    return { ok: false, error: "saveFailed" };
  }

  refreshDashboard();
  return { ok: true };
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
 * "Move N records to your account?" → Yes (Part D2, Owner, first login).
 * Upserts on (business_id, client_id), so a retry never doubles anything.
 * The browser removes its copies only after `ok: true`.
 */
export async function importGuestEntries(
  entries: readonly ClientEntry[],
): Promise<ImportGuestEntriesResult> {
  const parsed = importSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };

  try {
    const supabase = await createSupabaseServerClient();
    const membership = await new BusinessRepository(supabase).findFirstMembership(user.id);
    if (!membership || !can(membership.role, "importGuestEntries")) {
      return { ok: false, error: "notOwner" };
    }

    const outcome = await new EntryRepository(supabase).importClientEntries(
      membership.business.id,
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
