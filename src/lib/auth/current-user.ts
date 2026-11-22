import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { hasAuthCookie } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The few facts about the logged-in person that pages need. Nothing secret. */
export interface CurrentUser {
  id: string;
  email: string | null;
  /** "aal2" when the person also entered their authenticator code (two-step login), else "aal1". */
  assuranceLevel: "aal1" | "aal2";
}

/**
 * Who is logged in, or `null` for a guest (Part F2, "Data Access Layer").
 *
 * Reads the request cookies, so callers must sit inside a <Suspense>
 * boundary (Cache Components). `cache()` makes repeated calls in the same
 * request free.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  if (!hasAuthCookie(cookieStore.getAll())) return null;

  // Checking the login reads the clock (token expiry). Tell Next.js this part
  // runs at request time, so it is never part of a prerender (Cache Components).
  await connection();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    assuranceLevel: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});
