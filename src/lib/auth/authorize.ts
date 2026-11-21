import "server-only";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BusinessRepository, type Membership } from "@/lib/business/business-repository";
import { can, type Permission } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Access =
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; membership: Membership }
  | { ok: false; error: "notLoggedIn" | "notAllowed" };

/**
 * The check every Server Action starts with (Part F4.2): who is logged in,
 * which shop and role they have, and whether that role may do `permission`
 * (Part B2). Row Level Security checks again in the database.
 *
 * Returns the person's own Supabase client, so everything done with it stays
 * inside what they are allowed to see.
 */
export async function authorize(permission: Permission): Promise<Access> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notLoggedIn" };

  const supabase = await createSupabaseServerClient();
  const membership = await new BusinessRepository(supabase).findFirstMembership(user.id);
  if (!membership || !can(membership.role, permission)) return { ok: false, error: "notAllowed" };

  return { ok: true, supabase, membership };
}
