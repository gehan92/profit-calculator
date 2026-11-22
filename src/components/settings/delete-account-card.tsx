"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAccount } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { TypedConfirmDialog } from "@/components/ui/typed-confirm-dialog";
import { useRouter } from "@/i18n/navigation";
import { DELETE_CONFIRMATION_WORD, isDeleteConfirmed } from "@/lib/account/delete-confirmation";

/**
 * Settings → "Delete my account" (Part D2 "delete account (type DELETE)").
 * The button only opens a box; nothing is deleted until the person types
 * DELETE and confirms. Afterwards they land on a "your account is deleted" page.
 */
export function DeleteAccountCard() {
  const t = useTranslations("settings");
  const tEntry = useTranslations("entry");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm(typed: string) {
    if (!navigator.onLine) {
      toast.error(tEntry("offlineAction"));
      return;
    }

    setBusy(true);
    try {
      const result = await deleteAccount(typed);
      if (result.ok) {
        router.replace("/account-deleted");
        return;
      }
      toast.error(t("deleteFailed"));
    } catch {
      toast.error(t("deleteFailed"));
    }
    setBusy(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-12 w-full border-destructive/40 bg-background py-2 text-base whitespace-normal text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:px-6"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
        {t("deleteButton")}
      </Button>

      <TypedConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("deleteDialogTitle")}
        description={t("deleteDialogBody")}
        typeLabel={t("deleteTypeLabel")}
        placeholder={DELETE_CONFIRMATION_WORD}
        isConfirmed={isDeleteConfirmed}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={tEntry("cancel")}
        busyLabel={t("deleting")}
        busy={busy}
        destructive
        onConfirm={confirm}
      />
    </>
  );
}
