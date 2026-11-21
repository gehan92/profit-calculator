"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteAccount } from "@/actions/account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { DELETE_CONFIRMATION_WORD, isDeleteConfirmed } from "@/lib/account/delete-confirmation";
import { cn } from "@/lib/utils";

/**
 * Settings → "Delete my account" (Part D2 "delete account (type DELETE)").
 * The button only opens a box; nothing is deleted until the person types
 * DELETE and confirms. Afterwards they land on a "your account is deleted" page.
 */
export function DeleteAccountCard() {
  const t = useTranslations("settings");
  const tEntry = useTranslations("entry");
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  function changeOpen(next: boolean) {
    if (busy) return; // never close the box while deleting
    setOpen(next);
    setTyped("");
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDeleteConfirmed(typed) || busy) return;

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

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent showCloseButton={false}>
          <form onSubmit={confirm} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg leading-snug">{t("deleteDialogTitle")}</DialogTitle>
              <DialogDescription className="text-base">{t("deleteDialogBody")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor={inputId} className="text-base font-medium">
                {t("deleteTypeLabel")}
              </Label>
              <input
                id={inputId}
                type="text"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={DELETE_CONFIRMATION_WORD}
                className={cn(
                  "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                )}
              />
            </div>

            {/* Cancel first (left on wide screens); on phones the buttons stack with the red one on top. */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 bg-background py-2 leading-tight whitespace-normal"
                onClick={() => changeOpen(false)}
                disabled={busy}
              >
                {tEntry("cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="h-auto min-h-12 py-2 leading-tight whitespace-normal"
                disabled={!isDeleteConfirmed(typed) || busy}
              >
                {busy ? t("deleting") : t("deleteConfirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
