"use client";

import { BanIcon, MailIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { blockUser, deleteUser, sendLoginHelp, unblockUser, type AdminUserActionResult } from "@/actions/admin/users";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TypedConfirmDialog } from "@/components/ui/typed-confirm-dialog";
import { adminRoutes } from "@/lib/admin/admin-roles";

interface UserActionsProps {
  user: { id: string; hasEmail: boolean; name: string; blocked: boolean };
  /** Block, unblock and delete: Admin only, and never for yourself or another Admin. */
  canManage: boolean;
  /** Login help: Support and Admin. */
  canLoginHelp: boolean;
}

const ERRORS: Record<string, string> = {
  notFound: "This user no longer exists.",
  self: "You cannot do this to your own account.",
  admin: "You cannot do this to another Admin.",
  emailMismatch: "The email you typed does not match.",
  noEmail: "This user has no email address.",
  notAllowed: "You are not allowed to do this.",
  invalid: "Something is wrong with this request.",
  failed: "It did not work. Please try again.",
};

/**
 * The buttons on a user's page (Part C2 "Admin — User detail": Block, Delete,
 * Login help). Deleting asks you to type the user's email (Part C1.6). Every
 * action is checked again on the server and written to the audit log.
 */
export function UserActions({ user, canManage, canLoginHelp }: UserActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"block" | "unblock" | "delete" | "login" | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Runs one action, then shows what happened. Returns true when it worked. */
  async function run(kind: NonNullable<typeof busy>, action: () => Promise<AdminUserActionResult>, done: string): Promise<boolean> {
    setBusy(kind);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(ERRORS[result.error] ?? ERRORS.failed);
        return false;
      }
      toast.success(done);
      if (!result.auditSaved) toast.warning("Done, but the audit log row could not be saved.");
      return true;
    } catch {
      toast.error(ERRORS.failed);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function block() {
    setConfirmBlock(false);
    if (await run("block", () => blockUser(user.id), "User blocked")) router.refresh();
  }

  async function unblock() {
    if (await run("unblock", () => unblockUser(user.id), "User unblocked")) router.refresh();
  }

  async function remove(typedEmail: string) {
    if (await run("delete", () => deleteUser(user.id, typedEmail), "User deleted")) {
      router.replace(adminRoutes.users);
    } else {
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canLoginHelp && (
        <Button
          type="button"
          variant="outline"
          className="h-11 bg-background"
          disabled={busy !== null || !user.hasEmail}
          onClick={() => void run("login", () => sendLoginHelp(user.id), "Login link sent")}
        >
          <MailIcon data-icon="inline-start" aria-hidden="true" />
          {busy === "login" ? "Sending…" : "Send login link"}
        </Button>
      )}

      {canManage &&
        (user.blocked ? (
          <Button type="button" variant="outline" className="h-11 bg-background" disabled={busy !== null} onClick={() => void unblock()}>
            <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
            {busy === "unblock" ? "Unblocking…" : "Unblock"}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-11 bg-background" disabled={busy !== null} onClick={() => setConfirmBlock(true)}>
            <BanIcon data-icon="inline-start" aria-hidden="true" />
            Block
          </Button>
        ))}

      {canManage && (
        <Button
          type="button"
          variant="outline"
          className="h-11 border-destructive/40 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy !== null}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2Icon data-icon="inline-start" aria-hidden="true" />
          Delete…
        </Button>
      )}

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={`Block ${user.name}?`}
        description="They will see “Your account is paused” and cannot add records. You can unblock them at any time."
        confirmLabel="Yes, block"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void block()}
      />

      <TypedConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${user.name}?`}
        description="Their login, their shops and every record in them are deleted for ever. This cannot be undone."
        typeLabel="Type the user's full email address (the one they gave you)"
        placeholder="name@example.com"
        isConfirmed={(typed) => typed.trim().includes("@")}
        confirmLabel="Delete everything"
        cancelLabel="Cancel"
        busyLabel="Deleting…"
        busy={busy === "delete"}
        destructive
        onConfirm={(typed) => void remove(typed)}
      />
    </div>
  );
}
