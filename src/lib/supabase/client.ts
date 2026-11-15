import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
import type { Database } from "./types";

/**
 * Supabase client for Client Components (login buttons, later the offline queue).
 * The login session is kept in cookies, so the server sees the same user.
 * `createBrowserClient` returns one shared instance per page.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = supabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
