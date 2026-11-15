"use client";

import { CloudUploadIcon, InboxIcon, SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { authRoutes } from "@/lib/auth/routes";
import { monthOf } from "@/lib/dates";
import type { ClientEntry, EntryFields } from "@/lib/entries/entry";
import { EntryBook } from "@/lib/entries/entry-book";
import { guestEntryStore, GuestStoreFullError, MAX_GUEST_ENTRIES } from "@/lib/guest-store";
import { EntryForm } from "./entry-form";
import { EntryList } from "./entry-list";
import { TodaySummary } from "./today-summary";
import { useGuestEntries } from "./use-guest-entries";
import { useToday } from "./use-today";

/** "After 3+ local entries, show a soft prompt" (Part C1.1). */
const SAVE_PROMPT_AFTER = 3;

/** How long the Undo button stays after deleting (Part D2: 5-second Undo). */
const UNDO_MS = 5000;

/**
 * Guest "My Business (try)" (Part C1.1): today's profit, Add entry and the
 * records list, all saved in this browser only. After login the dashboard
 * offers to move these records into the account.
 */
export function GuestBusiness() {
  const t = useTranslations("try");
  const tEntry = useTranslations("entry");
  const tBusiness = useTranslations("myBusiness");
  const entries = useGuestEntries();
  const today = useToday();
  const book = useMemo(() => new EntryBook(entries ?? []), [entries]);

  if (entries === null || today === null) return <GuestBusinessSkeleton />;

  function save(fields: EntryFields): boolean {
    try {
      guestEntryStore.add(fields);
    } catch (error) {
      if (!(error instanceof GuestStoreFullError)) throw error;
      toast.error(t("full", { max: MAX_GUEST_ENTRIES }));
      return false;
    }
    // Only labels, never the amount or the note (Part F4.6).
    track("entry_added", {
      type: fields.type,
      category: fields.category,
      role: "guest",
      offline: !navigator.onLine,
    });
    return true;
  }

  function remove(entry: ClientEntry) {
    const removed = guestEntryStore.remove(entry.clientId);
    if (!removed) return;
    toast(tEntry("deleted"), {
      duration: UNDO_MS,
      action: { label: tEntry("undo"), onClick: () => guestEntryStore.restore(removed) },
    });
  }

  return (
    <div className="space-y-6">
      <PhoneOnlyBanner />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TodaySummary today={book.forDay(today)} month={book.forMonth(monthOf(today))} />

          <section
            aria-labelledby="add-entry-title"
            className="rounded-2xl border bg-background p-5 sm:p-6"
          >
            <h2 id="add-entry-title" className="mb-5 text-lg font-semibold">
              {tBusiness("addTitle")}
            </h2>
            <EntryForm today={today} onSave={save} />
          </section>

          {/* Below the form, so adding a record never needs extra scrolling. */}
          {book.size >= SAVE_PROMPT_AFTER && <SavePrompt count={book.size} />}
        </div>

        <RecordsSection book={book} today={today} onDelete={remove} />
      </div>
    </div>
  );
}

function RecordsSection({
  book,
  today,
  onDelete,
}: {
  book: EntryBook<ClientEntry>;
  today: string;
  onDelete: (entry: ClientEntry) => void;
}) {
  const t = useTranslations("myBusiness");

  return (
    <section aria-labelledby="records-title" className="space-y-4">
      <h2 id="records-title" className="text-lg font-semibold">
        {t("recordsTitle")}
      </h2>
      {book.size === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <InboxIcon aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("emptyBody")}</p>
        </div>
      ) : (
        <EntryList
          days={book.days()}
          today={today}
          entryKey={(entry) => entry.clientId}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}

/** "Saved on this phone only — log in to keep it safe" (Part C1.1). */
function PhoneOnlyBanner() {
  const t = useTranslations("try");

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-warning/10 p-4 sm:flex-row sm:items-center">
      <p className="flex flex-1 items-start gap-3 text-sm font-medium">
        <SmartphoneIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
        {t("banner")}
      </p>
      <Button asChild variant="outline" className="h-auto min-h-11 shrink-0 bg-background py-2 whitespace-normal">
        <Link href={authRoutes.login}>{t("bannerCta")}</Link>
      </Button>
    </div>
  );
}

/** "Save your records forever — free", shown after 3 records (Part C1.1 key moment). */
function SavePrompt({ count }: { count: number }) {
  const t = useTranslations("try");

  return (
    <section className="rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <CloudUploadIcon aria-hidden="true" className="size-5 shrink-0" />
        {t("savePromptTitle")}
      </h2>
      <p className="mt-2 text-pretty text-primary-foreground/85">{t("savePromptBody", { count })}</p>
      <Button
        asChild
        variant="secondary"
        className="mt-4 h-auto min-h-12 w-full py-2 text-center leading-tight whitespace-normal sm:w-auto"
      >
        <Link href={authRoutes.login}>{t("savePromptCta")}</Link>
      </Button>
    </section>
  );
}

function GuestBusinessSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Skeleton className="h-60 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
