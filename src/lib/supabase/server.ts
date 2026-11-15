import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * It acts as the logged-in user, so Row Level Security decides what it can
 * read and write (Part F2, step 2). Create a new one for every request; never
 * share it between requests.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = supabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is fine: the proxy
          // (src/proxy.ts) refreshes the session on every page request.
          // Server Actions and Route Handlers can write, so this does not run there.
        }
      },
    },
  });
}
