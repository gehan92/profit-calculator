"use client";

import { CloudUploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { importGuestEntries } from "@/actions/entries";
import { useGuestEntries } from "@/components/my-business/use-guest-entries";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { IMPORT_BATCH_SIZE, type ClientEntry } from "@/lib/entries/entry";
import { guestEntryStore } from "@/lib/guest-store";

type MoveError = "failed" | "notOwner";

/** Sinhala and Tamil labels are long: let buttons wrap instead of cutting the text. */
const WRAPPING_BUTTON = "h-auto min-h-12 py-2 text-center leading-tight whitespace-normal";

/**
 * "Move N records to your account?" Yes / No (Part C2 "Move guest data",
 * Part D2). Shown to an Owner while records from guest mode are still in
 * this browser.
 *
 * Yes sends them with `importGuestEntries` and removes each batch from the
 * phone only after the server confirms it. If the connection drops halfway,
 * tapping Yes again is safe: the server skips records it already has
 * (same `client_id`), so nothing is stored twice.
 *
 * "Not now" hides the question until the dashboard is opened again; the
 * records stay on the phone.
 */
export function GuestImportPrompt() {
  const t = useTranslations("guestImport");
  const router = useRouter();
  const entries = useGuestEntries();
  const [dismissed, setDismissed] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<MoveError | null>(null);

  if (!entries || entries.length === 0 || dismissed) return null;

  async function moveAll(toMove: readonly ClientEntry[]) {
    setMoving(true);
    setError(null);

    let moved = 0;
    for (const batch of inBatches(toMove, IMPORT_BATCH_SIZE)) {
      const result = await importGuestEntries(batch).catch(() => null);
      if (!result?.ok) {
        setError(result?.error === "notOwner" ? "notOwner" : "failed");
        setMoving(false);
        if (moved > 0) router.refresh();
        return;
      }
      // Safe in the account now: forget only these, not records added meanwhile.
      guestEntryStore.removeMany(batch.map((entry) => entry.clientId));
      moved += batch.length;
    }

    track("guest_import", { count: moved });
    toast.success(t("done", { count: moved }));
    setMoving(false);
    router.refresh();
  }

  return (
    <section
      aria-labelledby="guest-import-title"
      className="rounded-2xl border-2 border-primary/30 bg-primary-soft/60 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CloudUploadIcon aria-hidden="true" className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 id="guest-import-title" className="text-lg font-semibold text-balance">
            {t("title", { count: entries.length })}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{t("body")}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-loss/10 p-3 text-sm font-medium text-loss">
          {t(error)}
        </p>
      )}

      <div className="mt-5 grid gap-2 sm:flex">
        <Button className={WRAPPING_BUTTON} disabled={moving} onClick={() => moveAll(entries)}>
          {moving ? t("moving") : t("yes")}
        </Button>
        <Button
          variant="ghost"
          className={WRAPPING_BUTTON}
          disabled={moving}
          onClick={() => setDismissed(true)}
        >
          {t("no")}
        </Button>
      </div>
    </section>
  );
}

function inBatches<Item>(items: readonly Item[], size: number): Item[][] {
  const batches: Item[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}
