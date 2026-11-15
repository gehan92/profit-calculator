"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BusinessRepository } from "@/lib/business/business-repository";
import { addDays, utcIsoDate } from "@/lib/dates";
import { clientEntrySchema, IMPORT_BATCH_SIZE, type ClientEntry } from "@/lib/entries/entry";
import { EntryRepository } from "@/lib/entries/entry-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Result shape every action returns (Part F4.2). */
export type ImportGuestEntriesResult =
  | { ok: true; added: number; alreadySaved: number }
  | { ok: false; error: "invalid" | "notLoggedIn" | "notOwner" | "saveFailed" };

const importSchema = z
  .array(clientEntrySchema)
  .min(1)
  .max(IMPORT_BATCH_SIZE)
  // "No future dates" (Part F5). The server doesn't know the phone's
  // timezone, so it allows up to one day ahead of UTC (Sri Lanka is UTC+5:30).
  .refine((entries) => {
    const latest = addDays(utcIsoDate(), 1);
    return entries.every((entry) => entry.entryDate <= latest);
  });

/**
 * "Move N records to your account?" → Yes (Part D2, Owner, first login).
 *
 * Validate with zod → get the user → check they own their shop → upsert on
 * (business_id, client_id), so a retry never doubles anything → refresh.
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
    // Only an Owner moves guest records in (RLS would also refuse other shops).
    if (membership?.role !== "owner") return { ok: false, error: "notOwner" };

    const outcome = await new EntryRepository(supabase).importClientEntries(
      membership.business.id,
      uniqueByClientId(parsed.data),
    );

    revalidatePath("/[locale]/dashboard", "layout");
    return { ok: true, ...outcome };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

/** The same entry twice in one request counts once. */
function uniqueByClientId(entries: readonly ClientEntry[]): ClientEntry[] {
  return [...new Map(entries.map((entry) => [entry.clientId, entry])).values()];
}
