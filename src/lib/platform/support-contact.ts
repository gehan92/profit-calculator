import { siteConfig } from "@/config/site";
import { whatsappLink } from "@/lib/whatsapp";
import { getPlatformSettings } from "./platform-settings";

/**
 * Picks the WhatsApp number for the support button: the one the Admin typed in
 * Settings, otherwise the one from the environment variable
 * `NEXT_PUBLIC_SUPPORT_WHATSAPP` (Part F1). Empty when neither is set.
 */
export function pickSupportNumber(settingNumber: string, environmentNumber: string): string {
  return settingNumber.trim() || environmentNumber.trim();
}

/** A link to the support WhatsApp chat, or `null` when no (valid) number is set: the button is then hidden. */
export function supportWhatsAppLink(
  settingNumber: string,
  environmentNumber: string,
  text?: string,
): string | null {
  const number = pickSupportNumber(settingNumber, environmentNumber);
  return number ? whatsappLink(number, text) : null;
}

/** Same, reading the Admin's setting. For Server Components. */
export async function getSupportWhatsAppLink(text?: string): Promise<string | null> {
  const { support } = await getPlatformSettings();
  return supportWhatsAppLink(support.whatsapp, siteConfig.supportWhatsApp, text);
}
