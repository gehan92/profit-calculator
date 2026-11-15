import { track as vercelTrack } from "@vercel/analytics";

/**
 * Analytics events (Part F4.6), defined once.
 *
 * Privacy rule: never send amounts, notes or anything a person typed.
 * Properties are only short labels (which calculator, which language)
 * or counts. The types below make it a compile error to add others.
 */
export interface AnalyticsEvents {
  /** First result shown on a calculator. */
  calc_used: { calculator: string; locale: string };
  /** WhatsApp share tapped. `page` is a path without the language, e.g. "/profit-calculator". */
  share_whatsapp: { page: string };
  /** "Save to my records" tapped by a guest. */
  save_prompt_clicked: { page: string };
  /** First login (Day 6). */
  signup: { method: "google" | "phone" | "email" };
  /** Guest entries moved to an account (Day 7). */
  guest_import: { count: number };
  /** Entry saved (Day 8). */
  entry_added: { type: "income" | "expense"; category: string; role: string; offline: boolean };
  /** Monthly summary opened (Day 10). */
  summary_viewed: { role: string };
  /** Added to the home screen (Day 12). */
  pwa_installed: Record<string, never>;
  /** Feedback submitted. */
  feedback_sent: Record<string, never>;
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/**
 * Sends one event. Safe to call anywhere in the browser: it never throws,
 * so analytics can never break a calculator.
 *
 * Provider: Vercel Web Analytics. Note that Vercel only records custom
 * events on the Pro plan; on the free Hobby plan these calls are ignored
 * (page views still work). To use PostHog's free plan instead, change
 * only the body of this function.
 */
export function track<Name extends AnalyticsEventName>(
  name: Name,
  properties: AnalyticsEvents[Name],
): void {
  try {
    vercelTrack(name, properties);
  } catch {
    // Analytics must never break the page.
  }
}
