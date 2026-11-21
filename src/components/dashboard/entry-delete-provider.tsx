"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { deleteEntry } from "@/actions/entries";
import { DelayedActions } from "@/lib/delayed-actions";
import { DELETE_UNDO_SECONDS } from "@/lib/entries/entry";

const UNDO_MS = DELETE_UNDO_SECONDS * 1000;

interface EntryDeleteContextValue {
  /** Entries deleted on screen whose Undo time has not run out yet. Lists hide them. */
  hiddenIds: ReadonlySet<string>;
  /** Hides the entry now, shows "Record deleted — Undo", and deletes it for real after 5 seconds. */
  requestDelete: (entryId: string) => void;
}

const EntryDeleteContext = createContext<EntryDeleteContextValue | null>(null);

/**
 * Delete with a 5-second Undo (Part D2 "Entries list"), shared by every
 * dashboard screen.
 *
 * It sits in the dashboard layout for two reasons:
 * - the layout stays while people move between screens, so walking away does
 *   not cancel or rush the delete, and a record waiting to be deleted stays
 *   hidden on every screen;
 * - Next.js only keeps a Server Action on pages whose code uses it. A delete
 *   that fires after the person moved to another screen would be refused by
 *   that screen's server route; the layout is part of every dashboard page.
 *
 * Closing the browser tab inside the 5 seconds drops the delete: the record
 * simply stays, which is the safe outcome.
 */
export function EntryDeleteProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("entry");
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const waiting = useRef<DelayedActions>(null);
  if (waiting.current === null) waiting.current = new DelayedActions();

  const setHidden = useCallback((id: string, hidden: boolean) => {
    setHiddenIds((previous) => {
      const next = new Set(previous);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** Really deletes (after the 5 seconds). If that fails, the entry comes back. */
  const commit = useCallback(
    async (id: string) => {
      const result = await deleteEntry(id).catch(() => null);
      // "Not found" means it is already gone: nothing to bring back.
      if (!result?.ok && result?.error !== "notFound") {
        setHidden(id, false);
        toast.error(t("deleteFailed"));
      }
    },
    [setHidden, t],
  );

  const requestDelete = useCallback(
    (id: string) => {
      if (!navigator.onLine) {
        toast.error(t("offlineAction"));
        return;
      }

      const actions = waiting.current;
      if (!actions) return;
      setHidden(id, true);
      actions.schedule(id, UNDO_MS, () => void commit(id));
      toast(t("deleted"), {
        duration: UNDO_MS,
        action: {
          label: t("undo"),
          onClick: () => {
            actions.cancel(id);
            setHidden(id, false);
          },
        },
      });
    },
    [commit, setHidden, t],
  );

  const value = useMemo(() => ({ hiddenIds, requestDelete }), [hiddenIds, requestDelete]);

  return <EntryDeleteContext.Provider value={value}>{children}</EntryDeleteContext.Provider>;
}

/** The shared delete-with-Undo. Must be used inside `EntryDeleteProvider` (the dashboard layout). */
export function useEntryDelete(): EntryDeleteContextValue {
  const value = useContext(EntryDeleteContext);
  if (!value) throw new Error("useEntryDelete must be used inside EntryDeleteProvider");
  return value;
}
