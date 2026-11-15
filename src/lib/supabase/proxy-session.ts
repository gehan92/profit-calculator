import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { hasAuthCookie, supabaseConfig } from "./config";
import type { Database } from "./types";

/**
 * Refreshes the login session in the proxy (Part F2, step 1) and tells
 * who is logged in.
 *
 * New cookies and the "do not cache" headers from Supabase are written onto
 * `response`, which the proxy must then return (or copy onto a redirect with
 * `copySessionTo`), otherwise the user is logged out on the next request.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ userId: string | null }> {
  // Guests have no login cookie: skip the network call, keep calculators fast.
  if (!hasAuthCookie(request.cookies.getAll())) return { userId: null };

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
  return { userId: data?.claims?.sub ?? null };
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
