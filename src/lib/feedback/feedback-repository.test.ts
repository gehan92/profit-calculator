import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { FeedbackQueryError, FeedbackRepository } from "./feedback-repository";

function fakeClient(error: { message: string } | null = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as SupabaseClient<Database>, from, insert };
}

describe("FeedbackRepository.add", () => {
  it("saves the message with the contact, page and who sent it", async () => {
    const { client, from, insert } = fakeClient();
    await new FeedbackRepository(client).add(
      { message: "Hello", contact: "a@b.co", page: "/en/home" },
      "user-1",
    );
    expect(from).toHaveBeenCalledWith("feedback");
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      message: "Hello",
      contact: "a@b.co",
      page: "/en/home",
    });
  });

  it("saves a guest's message with no user", async () => {
    const { client, insert } = fakeClient();
    await new FeedbackRepository(client).add({ message: "Hi", contact: null, page: null }, null);
    expect(insert).toHaveBeenCalledWith({ user_id: null, message: "Hi", contact: null, page: null });
  });

  it("throws when the database refuses", async () => {
    const { client } = fakeClient({ message: "boom" });
    await expect(
      new FeedbackRepository(client).add({ message: "Hi", contact: null, page: null }, null),
    ).rejects.toBeInstanceOf(FeedbackQueryError);
  });
});
