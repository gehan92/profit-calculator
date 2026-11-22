/**
 * WhatsApp links, in one place (Part D2 "WhatsApp support button", Part D4
 * "reply via WhatsApp"). A phone number typed by a person can have spaces,
 * dashes, a "+" or a leading 0; WhatsApp wants it in international form.
 */

const PHONE = /^\+?\d{8,15}$/;

/** Country code added to a number written with a leading 0 (Sri Lanka). */
const DEFAULT_COUNTRY_CODE = "94";

/**
 * "+94 77 123 4567", "077-123-4567" and "94771234567" all become "94771234567".
 * Returns `null` when the text is not a phone number.
 */
export function toInternationalNumber(input: string): string | null {
  const digits = input.trim().replace(/[\s-]/g, "");
  if (!PHONE.test(digits)) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  return digits.startsWith("0") ? `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}` : digits;
}

/** A link that opens a WhatsApp chat with `number`, optionally with a first message typed in. */
export function whatsappLink(number: string, text?: string): string | null {
  const international = toInternationalNumber(number);
  if (!international) return null;
  return `https://wa.me/${international}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
