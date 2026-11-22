/**
 * Hides most of an email address or phone number (Part B4: the admin sees
 * contact details masked, e.g. `k***@gmail.com` and `+947 *** **12`). The
 * rules are the same as in the database functions (migration 0005), so the
 * audit log and the screens look alike.
 */

/** `kamala@gmail.com` → `k***@gmail.com`; `null` when there is no email. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  const domain = at >= 0 ? email.slice(at + 1) : "";
  return `${email.slice(0, 1)}***@${domain}`;
}

/**
 * `+94771234567` and `94771234567` (how Supabase stores it) → `+947 *** **67`;
 * numbers with fewer than 7 digits are hidden completely. Same rule as
 * `mask_phone()` in migration 0008.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "*** **";
  return `+${digits.slice(0, 3)} *** **${digits.slice(-2)}`;
}

/** A short, safe label for a user whose name and email are hidden: `User 7f3a91c2`. */
export function userLabel(user: { id: string; emailMasked: string | null }): string {
  return user.emailMasked ?? `User ${user.id.slice(0, 8)}`;
}
