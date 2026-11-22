import "server-only";
import { createClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { authRoutes, dashboardPath } from "@/lib/auth/routes";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";
import type { SendLoginLink } from "./admin-user-service";

/**
 * "Login help" (Part D4 User actions): emails the user a fresh login link,
 * exactly as if they had asked for it on the login page.
 *
 * The link goes only to the user's own inbox. It is never shown to the admin,
 * because a link that logs in as the user would let an admin open the user's
 * shop (Part B3: admin sees totals only). `shouldCreateUser: false` makes sure
 * this never creates an account.
 *
 * It uses a one-off client with the public key and no stored session, so
 * nothing about the admin's own login is touched.
 */
export const sendLoginLink: SendLoginLink = async (email) => {
  const { url, publishableKey } = supabaseConfig();
  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const callback = new URL(authRoutes.callback, siteConfig.url);
  callback.searchParams.set("next", dashboardPath());

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
  });
  return !error;
};
