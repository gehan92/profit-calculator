import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { AdminUserService } from "./admin-user-service";

interface FakeOptions {
  profiles?: Record<string, { id: string; full_name: string | null; platform_role: "user" | "support" | "admin" }>;
  emails?: Record<string, string | null>;
  updatedRows?: number;
  deleteFails?: boolean;
  auditFails?: boolean;
}

/** A fake Supabase secret-key client that remembers what was done to it. */
function fakeAdmin(options: FakeOptions = {}) {
  const profiles = options.profiles ?? {
    "user-1": { id: "user-1", full_name: "Kamala", platform_role: "user" },
    "admin-2": { id: "admin-2", full_name: "Other Admin", platform_role: "admin" },
    "admin-1": { id: "admin-1", full_name: "Me", platform_role: "admin" },
  };
  const emails = options.emails ?? { "user-1": "kamala@example.com", "admin-2": "other@example.com", "admin-1": "me@example.com" };
  const done = { updates: [] as unknown[], deleted: [] as string[], audit: [] as Record<string, unknown>[] };

  const db = {
    from: (table: string) => {
      if (table === "audit_log") {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (options.auditFails) return { error: { message: "boom" } };
            done.audit.push(row);
            return { error: null };
          },
        };
      }
      return {
        select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: profiles[id] ?? null }) }) }),
        update: (values: unknown) => ({
          eq: (_c: string, id: string) => ({
            select: async () => {
              done.updates.push({ id, values });
              const rows = options.updatedRows ?? 1;
              return { data: Array.from({ length: rows }, () => ({ id })), error: null };
            },
          }),
        }),
      };
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: emails[id] === undefined ? null : { email: emails[id] } } }),
        deleteUser: async (id: string) => {
          if (options.deleteFails) return { error: { message: "boom" } };
          done.deleted.push(id);
          return { error: null };
        },
      },
    },
  } as unknown as SupabaseClient<Database>;
  return { db, done };
}

const actor = { id: "admin-1", email: "me@example.com" };

describe("AdminUserService.setBlocked", () => {
  it("blocks a user and writes the audit row with who, what and whom", async () => {
    const { db, done } = fakeAdmin();
    const result = await new AdminUserService(db, actor).setBlocked("user-1", true);

    expect(result).toEqual({ ok: true, auditSaved: true });
    expect(done.updates).toEqual([{ id: "user-1", values: { status: "blocked" } }]);
    expect(done.audit).toEqual([
      {
        actor_id: "admin-1",
        action: "user.block",
        target_user_id: "user-1",
        details: { actor_email: "me@example.com", email: "k***@example.com" },
      },
    ]);
  });

  it("unblocks a user", async () => {
    const { db, done } = fakeAdmin();
    await new AdminUserService(db, actor).setBlocked("user-1", false);
    expect(done.updates).toEqual([{ id: "user-1", values: { status: "active" } }]);
    expect(done.audit[0]).toMatchObject({ action: "user.unblock" });
  });

  it("refuses yourself and other Admins, and changes and logs nothing", async () => {
    const { db, done } = fakeAdmin();
    const service = new AdminUserService(db, actor);
    expect(await service.setBlocked("admin-1", true)).toEqual({ ok: false, error: "self" });
    expect(await service.setBlocked("admin-2", true)).toEqual({ ok: false, error: "admin" });
    expect(done.updates).toEqual([]);
    expect(done.audit).toEqual([]);
  });

  it("says not found for an unknown user", async () => {
    const { db } = fakeAdmin();
    expect(await new AdminUserService(db, actor).setBlocked("nobody", true)).toEqual({ ok: false, error: "notFound" });
  });

  it("fails without a log row when no profile row changed", async () => {
    const { db, done } = fakeAdmin({ updatedRows: 0 });
    expect(await new AdminUserService(db, actor).setBlocked("user-1", true)).toEqual({ ok: false, error: "failed" });
    expect(done.audit).toEqual([]);
  });

  it("still reports success, with a warning, when only the log row could not be saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { db } = fakeAdmin({ auditFails: true });
    expect(await new AdminUserService(db, actor).setBlocked("user-1", true)).toEqual({ ok: true, auditSaved: false });
  });
});

describe("AdminUserService.deleteUser", () => {
  it("deletes the login when the typed email matches (any letter case) and logs it", async () => {
    const { db, done } = fakeAdmin();
    const result = await new AdminUserService(db, actor).deleteUser("user-1", "  Kamala@Example.com ");
    expect(result).toEqual({ ok: true, auditSaved: true });
    expect(done.deleted).toEqual(["user-1"]);
    expect(done.audit[0]).toMatchObject({ action: "user.delete", target_user_id: "user-1", details: { email: "k***@example.com" } });
  });

  it("deletes nothing when the typed email is wrong or empty", async () => {
    const { db, done } = fakeAdmin();
    const service = new AdminUserService(db, actor);
    expect(await service.deleteUser("user-1", "kamala@example.co")).toEqual({ ok: false, error: "emailMismatch" });
    expect(await service.deleteUser("user-1", "")).toEqual({ ok: false, error: "emailMismatch" });
    expect(done.deleted).toEqual([]);
    expect(done.audit).toEqual([]);
  });

  it("never deletes yourself or another Admin, even with the right email typed", async () => {
    const { db, done } = fakeAdmin();
    const service = new AdminUserService(db, actor);
    expect(await service.deleteUser("admin-1", "me@example.com")).toEqual({ ok: false, error: "self" });
    expect(await service.deleteUser("admin-2", "other@example.com")).toEqual({ ok: false, error: "admin" });
    expect(done.deleted).toEqual([]);
  });

  it("cannot be confirmed for a user without an email", async () => {
    const { db } = fakeAdmin({ emails: { "user-1": null } });
    expect(await new AdminUserService(db, actor).deleteUser("user-1", "anything")).toEqual({ ok: false, error: "emailMismatch" });
  });

  it("reports a failed delete without writing a log row", async () => {
    const { db, done } = fakeAdmin({ deleteFails: true });
    expect(await new AdminUserService(db, actor).deleteUser("user-1", "kamala@example.com")).toEqual({ ok: false, error: "failed" });
    expect(done.audit).toEqual([]);
  });
});

describe("AdminUserService.sendLoginHelp", () => {
  it("sends the link to the user's own email and logs it", async () => {
    const { db, done } = fakeAdmin();
    const send = vi.fn().mockResolvedValue(true);
    const result = await new AdminUserService(db, actor).sendLoginHelp("user-1", send);

    expect(result).toEqual({ ok: true, auditSaved: true });
    expect(send).toHaveBeenCalledWith("kamala@example.com");
    expect(done.audit[0]).toMatchObject({ action: "user.login_help", target_user_id: "user-1" });
  });

  it("does not log when sending failed, and says when there is no email", async () => {
    const { db, done } = fakeAdmin({ emails: { "user-1": "kamala@example.com", "user-2": null }, profiles: {
      "user-1": { id: "user-1", full_name: "Kamala", platform_role: "user" },
      "user-2": { id: "user-2", full_name: "No Email", platform_role: "user" },
    } });
    const service = new AdminUserService(db, actor);
    expect(await service.sendLoginHelp("user-1", async () => false)).toEqual({ ok: false, error: "failed" });
    expect(await service.sendLoginHelp("user-2", async () => true)).toEqual({ ok: false, error: "noEmail" });
    expect(done.audit).toEqual([]);
  });

  it("can be used for an Admin's own account too (a login link goes only to its own inbox)", async () => {
    const { db } = fakeAdmin();
    expect(await new AdminUserService(db, actor).sendLoginHelp("admin-2", async () => true)).toEqual({ ok: true, auditSaved: true });
  });
});
