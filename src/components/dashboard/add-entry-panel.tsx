"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";
import { addEntry } from "@/actions/entries";
import { EntryForm } from "@/components/my-business/entry-form";
import { useToday } from "@/components/my-business/use-today";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import type { EntryFields, EntryType } from "@/lib/entries/entry";
import type { MemberRole } from "@/lib/roles";

interface AddEntryPanelProps {
  role: MemberRole;
  initialType: EntryType;
}

/**
 * Add entry for logged-in people (Part D2): saves to the shop with the
 * `addEntry` Server Action, shows "Saved" and stays ready for the next one.
 * Done when an entry takes under 10 seconds (Part G1, Day 8).
 */
export function AddEntryPanel({ role, initialType }: AddEntryPanelProps) {
  const t = useTranslations("addEntry");
  const tEntry = useTranslations("entry");
  const today = useToday();
  // The id of an entry whose save did not finish. Tapping Save again with the
  // same entry reuses it, so if the first try had reached the server after all
  // (the answer was lost), the entry is still stored once.
  const unfinished = useRef<{ fields: string; clientId: string } | null>(null);

  if (today === null) {
    return <Skeleton aria-hidden="true" className="h-[34rem] w-full rounded-2xl" />;
  }

  async function save(fields: EntryFields): Promise<boolean> {
    const fieldsKey = JSON.stringify(fields);
    const clientId =
      unfinished.current?.fields === fieldsKey ? unfinished.current.clientId : crypto.randomUUID();
    unfinished.current = { fields: fieldsKey, clientId };

    const result = await addEntry(fields, clientId).catch(() => null);

    if (!result?.ok) {
      const error = result?.error;
      toast.error(
        error === "futureDate"
          ? tEntry("futureDate")
          : error === "notAllowed"
            ? t("notAllowed")
            : t("saveFailed"),
      );
      return false;
    }

    unfinished.current = null;
    // Only labels, never the amount or the note (Part F4.6).
    track("entry_added", { type: fields.type, category: fields.category, role, offline: false });
    return true;
  }

  return (
    <EntryForm today={today} onSave={save} initialType={initialType} autoFocusAmount />
  );
}
