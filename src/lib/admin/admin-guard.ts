import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import type { PlatformRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAdmin, type AdminPermission } from "./admin-roles";
import { ADMIN_SECURITY_PATH, mfaRequired, nextMfaStep, type MfaStep } from "./mfa";

export interface PlatformContext {
  user: CurrentUser;
  /** The person's platform role; a blocked account counts as an ordinary user. */
  role: PlatformRole;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}

/**
 * Who is logged in and what they are on the website as a whole (user, support
 * or admin), or `null` for a guest. Read from the person's own profile through
 * their own session (RLS lets everyone read their own row). One database call
 * per request, shared by the layout, the page and the header.
 *
 * Reads the login cookie: call it inside a <Suspense> boundary.
 */
export const getPlatformContext = cache(async (): Promise<PlatformContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("platform_role, status")
    .eq("id", user.id)
    .maybeSingle();

  return { user, role: data?.status === "active" ? data.platform_role : "user", supabase };
});

/**
 * What a team member still has to do for two-step login (Part F5 "MFA for
 * admins"): "done" once the authenticator code was entered. Only people who
 * still have to enter it cost one extra call to Supabase (for the linked app),
 * so a finished login costs nothing.
 */
const getMfaStep = cache(async (context: PlatformContext): Promise<MfaStep> => {
  const { role, user, supabase } = context;
  if (!mfaRequired(role) || user.assuranceLevel === "aal2") return "done";

  const { data } = await supabase.auth.mfa.listFactors();
  return nextMfaStep({ role, level: user.assuranceLevel, hasFactor: (data?.totp.length ?? 0) > 0 });
});

/**
 * Opens an admin page (Part F2 "layout.tsx — server check"): anyone who may
 * not gets the normal 404 page, so the panel's existence is never revealed.
 * The proxy already answers 404 first; this is the second lock, because hiding
 * links or relying on one layer is never security (Part B3).
 *
 * Until the authenticator code is entered the person is sent to the security
 * page; only that page passes `skipMfa`, and it uses the returned `mfaStep`.
 */
export async function requireAdminPage(
  permission: AdminPermission,
  options: { skipMfa?: boolean } = {},
): Promise<PlatformContext & { mfaStep: MfaStep }> {
  const context = await getPlatformContext();
  if (!context || !canAdmin(context.role, permission)) notFound();

  const mfaStep = await getMfaStep(context);
  if (mfaStep !== "done" && !options.skipMfa) redirect(ADMIN_SECURITY_PATH);
  return { ...context, mfaStep };
}

export type AdminAccess =
  | ({ ok: true } & PlatformContext)
  | { ok: false; error: "notAllowed" };

/**
 * The check every admin Server Action starts with (Part F4.2): the person
 * must be logged in, their role must allow `permission`, and a team member
 * must have entered their authenticator code. The reply never says whether the
 * panel exists: a refusal is just `notAllowed`.
 */
export async function authorizeAdmin(permission: AdminPermission): Promise<AdminAccess> {
  const context = await getPlatformContext();
  if (!context || !canAdmin(context.role, permission)) return { ok: false, error: "notAllowed" };
  if ((await getMfaStep(context)) !== "done") return { ok: false, error: "notAllowed" };
  return { ok: true, ...context };
}
