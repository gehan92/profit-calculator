"use client";

import { CloudOffIcon, RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { syncOfflineEntries } from "@/actions/entries";
import { Button } from "@/components/ui/button";
import { offlineEntryQueue } from "@/lib/offline-queue";
import { OfflineSyncer } from "@/lib/offline-syncer";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "./use-online-status";
import { useQueuedEntries } from "./use-queued-entries";

/** How long to wait before trying again after a failed send. */
const RETRY_AFTER_MS = 30_000;

/** One sender for the whole app: the queue lives in this browser, so there is one queue to send. */
const offlineSyncer = new OfflineSyncer(offlineEntryQueue, (entries) => syncOfflineEntries(entries));

/**
 * Starts sending as soon as the phone is online and the queue has entries
 * (this also runs the moment the connection comes back), and tries again every
 * 30 seconds after a failure. The sending itself is `OfflineSyncer`.
 */
function useOfflineSync(online: boolean, waiting: number) {
  const t = useTranslations("offline");
  const router = useRouter();
  const state = useSyncExternalStore(
    offlineSyncer.subscribe,
    offlineSyncer.getState,
    () => "idle" as const,
  );

  const run = useCallback(async () => {
    const report = await offlineSyncer.run();
    if (!report) return;
    if (report.saved > 0) toast.success(t("synced", { count: report.saved }));
    if (report.refused > 0) toast.error(t("refused", { count: report.refused }));
    // Logged out meanwhile: refreshing sends the person to the login page.
    if (report.error === "notLoggedIn") router.refresh();
  }, [router, t]);

  useEffect(() => {
    if (online && waiting > 0) void run();
  }, [online, waiting, run]);

  useEffect(() => {
    if (state !== "failed" || !online) return;
    const timer = window.setTimeout(() => void run(), RETRY_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [state, online, run]);

  return { state, run };
}

/**
 * The amber banner (Part E4 "Offline: Amber banner; entries queued"): says the
 * phone is offline, and how many records wait to be sent. Hidden when
 * everything is fine. It also sends the queue (see `useOfflineSync`).
 */
export function OfflineStatus() {
  const t = useTranslations("offline");
  const online = useOnlineStatus();
  const waiting = useQueuedEntries().length;
  const { state, run } = useOfflineSync(online, waiting);

  if (online && waiting === 0) return null;

  const sending = online && state === "sending";
  let message: ReactNode;
  if (!online) {
    message = (
      <>
        <strong className="block">{t("offlineTitle")}</strong>
        <span className="block font-normal">{t("offlineBody")}</span>
        {waiting > 0 && <span className="mt-1 block">{t("waiting", { count: waiting })}</span>}
      </>
    );
  } else if (sending) {
    message = t("sending", { count: waiting });
  } else {
    message = (
      <>
        {t("waiting", { count: waiting })}
        {state === "failed" && <span className="block font-normal">{t("retryLater")}</span>}
      </>
    );
  }

  return (
    <div role="status" className="border-b bg-warning/15">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <p className="flex flex-1 items-start gap-3 font-medium">
          {online ? (
            <RefreshCwIcon
              aria-hidden="true"
              className={cn("mt-0.5 size-5 shrink-0 text-warning-foreground", sending && "animate-spin")}
            />
          ) : (
            <CloudOffIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
          )}
          <span>{message}</span>
        </p>
        {online && !sending && (
          <Button
            variant="outline"
            className="h-auto min-h-11 shrink-0 bg-background py-2 leading-tight whitespace-normal"
            onClick={() => void run()}
          >
            {t("sendNow")}
          </Button>
        )}
      </div>
    </div>
  );
}
