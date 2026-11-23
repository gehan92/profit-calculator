import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { AVATAR_BUCKET } from "./avatar";

/**
 * Removes a person's profile photo files from Storage (everything in their own
 * folder, except `keep`). Used when a new photo replaces the old one, when the
 * photo is removed, and when the account is deleted, so no picture is ever
 * left behind. With the person's own client the database rules limit it to
 * their folder; with the secret key (account deletion) the folder is named by
 * the id the caller passes, never by anything the browser sent.
 */
export async function removeAvatarFiles(
  client: SupabaseClient<Database>,
  userId: string,
  keep?: string,
): Promise<void> {
  const storage = client.storage.from(AVATAR_BUCKET);
  const { data, error } = await storage.list(userId, { limit: 100 });
  if (error) throw new Error(`Could not list the photos: ${error.message}`);

  const paths = data.map((file) => `${userId}/${file.name}`).filter((path) => path !== keep);
  if (paths.length === 0) return;

  const removed = await storage.remove(paths);
  if (removed.error) throw new Error(`Could not remove the photos: ${removed.error.message}`);
}
