import "server-only";
import { isAccountPaused } from "@/lib/auth/account-status";
import { getCurrentUser } from "@/lib/auth/current-user";
import { takeWriteTurn, type WriteLimit } from "@/lib/auth/write-limits";
import { BusinessRepository, type Membership } from "@/lib/business/business-repository";
import { can, type Permission } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Access =
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; membership: Membership }
  | { ok: false; error: "notLoggedIn" | "notAllowed" };

/** What `authorize` returns when a spam limit is asked for: it can also say "too many". */
export type LimitedAccess = Access | { ok: false; error: "tooMany" };

/**
 * The check every Server Action starts with (Part F4.2): who is logged in,
 * which shop and role they have, and whether that role may do `permission`
 * (Part B2). A paused (blocked) account is refused. Row Level Security checks
 * again in the database.
 *
 * Pass `{ limit }` for actions that create or change records: a person who
 * calls them faster than any human could (Part F5 "Spam limits") gets
 * `tooMany`.
 *
 * Returns the person's own Supabase client, so everything done with it stays
 * inside what they are allowed to see.
 */
export async function authorize(permission: Permission): Promise<Access>;
export async function authorize(
  permission: Permission,
  options: { limit: WriteLimit },
): Promise<LimitedAccess>;
export async function authorize(
  permission: Permission,
  options?: { limit: WriteLimit },
): Promise<LimitedAccess> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };
  // A paused account may not do anything (the pages already send it to the paused screen).
  if (await isAccountPaused(user.id)) return { ok: false, error: "notAllowed" };

  const supabase = await createSupabaseServerClient();
  const membership = await new BusinessRepository(supabase).findFirstMembership(user.id);
  if (!membership || !can(membership.role, permission)) return { ok: false, error: "notAllowed" };

  // Counted last: only people who may do this at all use up their turns.
  if (options && !takeWriteTurn(options.limit, user.id)) return { ok: false, error: "tooMany" };

  return { ok: true, supabase, membership };
}
