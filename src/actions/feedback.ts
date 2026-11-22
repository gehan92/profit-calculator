"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { feedbackSchema } from "@/lib/feedback/feedback";
import { FeedbackRepository } from "@/lib/feedback/feedback-repository";
import { RateLimiter } from "@/lib/rate-limiter";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SendFeedbackResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "tooMany" | "failed" };

/** Part F5 "Spam limits": 5 messages in 10 minutes from one person or one address. */
const feedbackLimiter = new RateLimiter(5, 10 * 60 * 1000);

/**
 * Sends one feedback message (Part F4.2 `actions/feedback.ts`: everyone,
 * rate-limited). A guest may send too; a logged-in person's message is saved
 * with their id so the team can find who wrote it.
 *
 * `website` is a trap field: it is hidden from people, so only a script fills
 * it. Such a message is thrown away, but the sender is told it worked.
 */
export async function sendFeedback(input: {
  message: string;
  contact: string;
  page: string | null;
  website: string;
}): Promise<SendFeedbackResult> {
  if (typeof input?.website === "string" && input.website.trim() !== "") return { ok: true };

  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const user = await getCurrentUser();
  const sender = user ? `user:${user.id}` : `address:${await visitorAddress()}`;
  if (!feedbackLimiter.take(sender).allowed) return { ok: false, error: "tooMany" };

  try {
    const supabase = await createSupabaseServerClient();
    await new FeedbackRepository(supabase).add(parsed.data, user?.id ?? null);
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** The visitor's network address, as the hosting service reports it ("unknown" when it does not). */
async function visitorAddress(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}
