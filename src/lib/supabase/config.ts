/**
 * Supabase connection settings (Part F1), read once from `.env.local`.
 *
 * Only the public URL and the publishable key live here. They are safe in the
 * browser because Row Level Security protects the data. The secret key is
 * read only in `admin.ts` (server only, Day 11).
 */
export function supabaseConfig(): { url: string; publishableKey: string } {
  // Written out in full so Next.js can put the values into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }
  return { url, publishableKey };
}

/**
 * True when the request carries a Supabase login cookie (`sb-<ref>-auth-token`,
 * possibly split into `.0`, `.1` parts).
 *
 * Guests have no such cookie, so we can skip the auth check entirely and keep
 * the free calculators fast.
 */
export function hasAuthCookie(cookies: readonly { name: string }[]): boolean {
  return cookies.some((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
}
