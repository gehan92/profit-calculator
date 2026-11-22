import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { DEFAULT_SETTINGS, parseSettings, type AppSettings } from "@/lib/admin/app-settings";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

/** Saving a setting in the admin panel expires this tag (`updateTag`), so the change shows at once. */
export const SETTINGS_CACHE_TAG = "app-settings";

/**
 * The website-wide settings the Admin controls (maintenance mode, support
 * WhatsApp number...), for every visitor's page (Part F3 `app_settings`,
 * "everyone reads").
 *
 * They are the same for everybody, so they are read with a plain key-only
 * connection (no login cookie) and remembered by Next.js for a minute: a page
 * view costs no database call. If the database cannot be reached, the safe
 * defaults are used (maintenance OFF) and remembered only for a few seconds.
 */
export async function getPlatformSettings(): Promise<AppSettings> {
  "use cache";
  cacheTag(SETTINGS_CACHE_TAG);
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });

  try {
    const { url, publishableKey } = supabaseConfig();
    const supabase = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.from("app_settings").select("key, value");
    if (error) throw error;
    return parseSettings(data);
  } catch {
    // Do not keep a failure for long: look again very soon.
    cacheLife({ stale: 30, revalidate: 5, expire: 30 });
    return structuredClone(DEFAULT_SETTINGS);
  }
}
