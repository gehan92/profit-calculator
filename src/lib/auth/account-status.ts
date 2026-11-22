import "server-only";
import { cache } from "react";
import { ProfileRepository } from "@/lib/account/profile-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * True when an Admin has paused this person's account (Part C2: "Blocked user
 * logs in → 'Your account is paused' screen"). The dashboard sends them to
 * that screen and Server Actions refuse them. `cache()` makes the layout, the
 * page and the actions of one request share a single database call.
 *
 * If the status cannot be read, the person is treated as NOT paused: the
 * database (`is_active()` in the entry and shop rules) is the real lock.
 */
export const isAccountPaused = cache(async (userId: string): Promise<boolean> => {
  try {
    const supabase = await createSupabaseServerClient();
    return await new ProfileRepository(supabase).isBlocked(userId);
  } catch {
    return false;
  }
});
