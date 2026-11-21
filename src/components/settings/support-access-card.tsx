"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { setSupportAccess } from "@/actions/account";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDateLabels } from "@/components/use-date-labels";
import { useIsBrowser } from "@/components/use-is-browser";
import { localIsoDate } from "@/lib/dates";

/**
 * Settings → support access switch (Part D2, "7 days"): while it is on, the
 * support team may look at this shop's records; it turns itself off after 7
 * days. `initialUntil` is the stored end time, or `null` when it is off.
 */
export function SupportAccessCard({ initialUntil }: { initialUntil: string | null }) {
  const t = useTranslations("settings");
  const dates = useDateLabels();
  const browser = useIsBrowser();
  const switchId = useId();
  const [until, setUntil] = useState<string | null>(initialUntil);
  const [busy, setBusy] = useState(false);

  async function change(enabled: boolean) {
    setBusy(true);
    try {
      const result = await setSupportAccess(enabled);
      if (result.ok) setUntil(result.until);
      else toast.error(t("supportFailed"));
    } catch {
      toast.error(t("supportFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Label htmlFor={switchId} className="text-base leading-snug font-medium">
          {t("supportLabel")}
        </Label>
        <Switch
          id={switchId}
          checked={until !== null}
          disabled={busy}
          onCheckedChange={(checked) => void change(checked)}
        />
      </div>
      {/* The end date is written in the phone's own calendar, so it is shown once the page is in the browser. */}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {until === null
          ? t("supportOff")
          : browser
            ? t("supportOn", { date: dates.dayMonthYear(localIsoDate(new Date(until))) })
            : ""}
      </p>
    </div>
  );
}
