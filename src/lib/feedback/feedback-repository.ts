import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { FeedbackInput } from "./feedback";

/** Thrown when Supabase refuses or fails to save feedback. */
export class FeedbackQueryError extends Error {
  constructor(cause: { message: string }) {
    super(`Could not save feedback: ${cause.message}`);
    this.name = "FeedbackQueryError";
  }
}

/**
 * Saves feedback (Part F3 `feedback`). Anyone may add a row, a guest too; the
 * database rule only lets a logged-in person put their OWN id on it. Nobody but
 * the team can read rows back, so this class never asks for the row (no
 * `.select()`): with the guest's key that would fail.
 */
export class FeedbackRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async add(input: FeedbackInput, userId: string | null): Promise<void> {
    const { error } = await this.db.from("feedback").insert({
      user_id: userId,
      message: input.message,
      contact: input.contact,
      page: input.page,
    });
    if (error) throw new FeedbackQueryError(error);
  }
}
