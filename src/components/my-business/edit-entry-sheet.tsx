"use client";

import { Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { updateEntry } from "@/actions/entries";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isoDateToDate, type IsoDate } from "@/lib/dates";
import type { DisplayEntry } from "@/lib/entries/display-entry";
import { DELETE_UNDO_SECONDS, type EntryFields } from "@/lib/entries/entry";
import { can, type MemberRole } from "@/lib/roles";
import { EntryForm, type SaveResult } from "./entry-form";

interface EditEntrySheetProps {
  /** The entry being changed; `null` keeps the sheet closed. */
  entry: DisplayEntry | null;
  role: MemberRole;
  today: IsoDate;
  onClose: () => void;
  /** Called after "Delete" is confirmed. The screen then deletes with an Undo (see EntryDeleteProvider). */
  onDelete: (entry: DisplayEntry) => void;
}

/**
 * The edit sheet (Part D2 "Entries list": edit sheet; delete with confirm +
 * 5-second Undo). It slides up with the same form as Add entry, filled in.
 * Owners can also delete; Staff can only change their own entries from today,
 * and not move them to another day.
 */
export function EditEntrySheet({ entry, role, today, onClose, onDelete }: EditEntrySheetProps) {
  const t = useTranslations("entry");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const { money } = useCalcFormat();
  const [confirming, setConfirming] = useState(false);

  async function save(fields: EntryFields): Promise<SaveResult> {
    if (!entry?.id) return false;
    if (!navigator.onLine) {
      toast.error(t("offlineAction"));
      return false;
    }

    const result = await updateEntry(entry.id, fields).catch(() => null);
    if (!result?.ok) {
      const error = result?.error;
      toast.error(
        error === "notFound"
          ? t("notFound")
          : error === "notAllowed"
            ? t("notAllowedEdit")
            : error === "futureDate"
              ? t("futureDate")
              : t("saveFailedEdit"),
      );
      // Already deleted or changed elsewhere: the list is refreshing, close the sheet.
      if (error === "notFound") onClose();
      return false;
    }

    toast.success(t("changed"));
    onClose();
    return true;
  }

  function confirmDelete() {
    setConfirming(false);
    if (entry) onDelete(entry);
  }

  return (
    <>
      <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl"
          // The amount is what gets corrected most often: start there (opens the keypad).
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("entry-amount")?.focus({ preventScroll: true });
          }}
        >
          <SheetHeader>
            <SheetTitle className="text-xl font-semibold">{t("editTitle")}</SheetTitle>
          </SheetHeader>

          {entry && (
            <div className="space-y-4 px-4 pb-6">
              <EntryForm
                key={entry.key}
                mode="edit"
                today={today}
                initial={entry}
                lockDate={role === "staff"}
                onSave={save}
              />
              {can(role, "deleteEntry") && (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-auto min-h-12 w-full py-2 leading-tight whitespace-normal"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                  {t("delete")}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirming && entry !== null}
        onOpenChange={setConfirming}
        title={t("deleteTitle")}
        description={
          entry
            ? t("deleteBody", {
                category: tCategory(entry.category),
                amount: money(entry.amountCents),
                date: format.dateTime(isoDateToDate(entry.entryDate), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }),
                seconds: DELETE_UNDO_SECONDS,
              })
            : ""
        }
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
