import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import type { Database } from "./types";

/**
 * Supabase client with the SECRET key (Part F1, Part F4.2): it skips Row Level
 * Security, so it is used only where the app must do something no user may do
 * for themselves. Today that is one thing: deleting a login account
 * (`auth.admin.deleteUser`), which needs this key.
 *
 * Rules: server only (this file imports `server-only`, so the browser bundle
 * can never include the key); create it inside the action that needs it, check
 * who is asking BEFORE using it, and never pass it to other code.
 */
export function createSupabaseAdminClient() {
  const { url } = supabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill it in.");
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
