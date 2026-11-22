import { whatsappLink } from "@/lib/whatsapp";

/**
 * A link to answer someone who sent feedback with a contact (Part D4 Feedback:
 * "reply via email/WhatsApp"). The contact is free text typed by a visitor, so
 * only two safe shapes become links; anything else is shown as plain text.
 */
export interface ReplyLink {
  kind: "email" | "whatsapp";
  href: string;
  label: string;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function replyLink(contact: string | null): ReplyLink | null {
  const text = (contact ?? "").trim();
  if (!text) return null;

  if (EMAIL.test(text)) {
    return { kind: "email", href: `mailto:${encodeURIComponent(text).replace("%40", "@")}`, label: "Reply by email" };
  }

  const href = whatsappLink(text);
  return href ? { kind: "whatsapp", href, label: "Reply on WhatsApp" } : null;
}
