import { z } from "zod";

/**
 * The rules for a feedback message (Part D2 "Feedback": message, optional
 * contact, page address attached automatically; Part F3 `feedback` table:
 * message 1–2000 characters). Written once, used by the form and the action.
 */

export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_CONTACT_MAX = 100;
export const FEEDBACK_PAGE_MAX = 200;

/**
 * The page the person came from, as a path on this website ("/si/profit-calculator").
 * Only a short path is accepted; anything else (another website, a long or odd
 * address) becomes "no page", so a visitor cannot use the field to store text.
 */
export function cleanPageParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (path.length === 0 || path.length > FEEDBACK_PAGE_MAX) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (!/^\/[\w\-./~%]*$/.test(path)) return null;
  return path;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

export const feedbackSchema = z.object({
  message: z.string().trim().min(1).max(FEEDBACK_MESSAGE_MAX),
  contact: optionalText(FEEDBACK_CONTACT_MAX),
  page: z
    .unknown()
    .transform((value) => cleanPageParam(value))
    .default(null),
});

export type FeedbackInput = z.output<typeof feedbackSchema>;
