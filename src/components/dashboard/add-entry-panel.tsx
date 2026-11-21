"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";
import { addEntry } from "@/actions/entries";
import { EntryForm, type SaveResult } from "@/components/my-business/entry-form";
import { useToday } from "@/components/my-business/use-today";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import type { EntryFields, EntryType } from "@/lib/entries/entry";
import { LocalStoreFullError } from "@/lib/local-entry-store";
import { offlineEntryQueue } from "@/lib/offline-queue";
import type { MemberRole } from "@/lib/roles";

interface AddEntryPanelProps {
  role: MemberRole;
  initialType: EntryType;
}

/**
 * Add entry for logged-in people (Part D2): saves to the shop with the
 * `addEntry` Server Action, shows "Saved" and stays ready for the next one.
 * Done when an entry takes under 10 seconds (Part G1, Day 8).
 *
 * Offline (Part F4.4): the entry is kept in a queue on this phone, with its
 * `client_id`, and sent by the offline sync once the phone is online again.
 */
export function AddEntryPanel({ role, initialType }: AddEntryPanelProps) {
  const t = useTranslations("addEntry");
  const tEntry = useTranslations("entry");
  const tOffline = useTranslations("offline");
  const today = useToday();
  // The id of an entry whose save did not finish. Tapping Save again with the
  // same entry reuses it, so if the first try had reached the server after all
  // (the answer was lost), the entry is still stored once.
  const unfinished = useRef<{ fields: string; clientId: string } | null>(null);

  if (today === null) {
    return <Skeleton aria-hidden="true" className="h-[34rem] w-full rounded-2xl" />;
  }

  /** Keeps the entry on this phone until the connection is back. */
  function queueOffline(fields: EntryFields, clientId: string): SaveResult {
    try {
      offlineEntryQueue.add(fields, new Date(), clientId);
    } catch (error) {
      if (!(error instanceof LocalStoreFullError)) throw error;
      toast.error(tOffline("queueFull"));
      return false;
    }
    unfinished.current = null;
    toast.success(tOffline("queued"));
    // Only labels, never the amount or the note (Part F4.6).
    track("entry_added", { type: fields.type, category: fields.category, role, offline: true });
    return "queued";
  }

  async function save(fields: EntryFields): Promise<SaveResult> {
    const fieldsKey = JSON.stringify(fields);
    const clientId =
      unfinished.current?.fields === fieldsKey ? unfinished.current.clientId : crypto.randomUUID();
    unfinished.current = { fields: fieldsKey, clientId };

    // No connection: go straight to the queue.
    if (!navigator.onLine) return queueOffline(fields, clientId);

    const result = await addEntry(fields, clientId).catch(() => null);
    // The request itself failed (no network, server unreachable): queue it. If it
    // had reached the server, the same client id is stored only once.
    if (result === null) return queueOffline(fields, clientId);

    if (!result.ok) {
      toast.error(
        result.error === "futureDate"
          ? tEntry("futureDate")
          : result.error === "notAllowed"
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
