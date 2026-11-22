import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { PlatformRole } from "@/lib/roles";
import { hasAuthCookie, supabaseConfig } from "./config";
import type { Database } from "./types";

/** Who is logged in, and how (see `CurrentUser.assuranceLevel`). */
export interface SessionInfo {
  userId: string | null;
  platformRole: PlatformRole | null;
  /** "aal2" once the authenticator code was entered; `null` for a guest. */
  assuranceLevel: "aal1" | "aal2" | null;
}

/**
 * Refreshes the login session in the proxy (Part F2, step 1) and tells
 * who is logged in.
 *
 * New cookies and the "do not cache" headers from Supabase are written onto
 * `response`, which the proxy must then return (or copy onto a redirect with
 * `copySessionTo`), otherwise the user is logged out on the next request.
 *
 * With `withPlatformRole` it also reads the person's role on the website
 * (user, support or admin) from their own profile: only /admin needs it, so
 * the extra database call is made only there.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
  options: { withPlatformRole?: boolean } = {},
): Promise<SessionInfo> {
  // Guests have no login cookie: skip the network call, keep calculators fast.
  if (!hasAuthCookie(request.cookies.getAll())) return { userId: null, platformRole: null, assuranceLevel: null };

  const { url, publishableKey } = supabaseConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getClaims() checks the token signature; never trust getSession() here.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  const assuranceLevel = data?.claims?.aal === "aal2" ? "aal2" : "aal1";
  if (!userId || !options.withPlatformRole) return { userId, platformRole: null, assuranceLevel };

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role, status")
    .eq("id", userId)
    .maybeSingle();
  // A blocked account is an ordinary user.
  return { userId, platformRole: profile?.status === "active" ? profile.platform_role : "user", assuranceLevel };
}

/** Moves refreshed session cookies and cache headers onto another response (e.g. a redirect). */
export function copySessionTo(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  for (const header of ["Cache-Control", "Expires", "Pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}
