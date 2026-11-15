"use server";

import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isAppLocale } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Logs out on this device and goes back to the home page in the same language.
 * The form sends `locale`, because Server Actions cannot read the language
 * from the address themselves.
 */
export async function signOut(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });

  const locale = formData.get("locale");
  redirect(`/${isAppLocale(locale) ? locale : DEFAULT_LOCALE}`);
}
