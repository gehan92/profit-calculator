"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { saveNotifications } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isReminderTime, type NotificationSettings } from "@/lib/account/profile";
import { cn } from "@/lib/utils";

/** One row: a label and its on/off switch. */
function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <Label htmlFor={id} className="text-base leading-snug font-medium">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Account → Notifications: the daily reminder (and its time), the weekly
 * summary and the payment emails. The choices are saved now; the emails
 * themselves start once email sending is set up, and the screen says so.
 */
export function NotificationsForm({ initial }: { initial: NotificationSettings }) {
  const t = useTranslations("accountPage");
  const timeId = useId();
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);

  const timeValid = isReminderTime(settings.dailyTime);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timeValid) return;
    if (!navigator.onLine) return void toast.error(t("common.offline"));

    setSaving(true);
    try {
      const result = await saveNotifications(settings);
      if (result.ok) toast.success(t("common.saved"));
      else toast.error(t("common.saveFailed"));
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <div className="space-y-3">
        <SwitchRow
          label={t("notifications.dailyLabel")}
          checked={settings.daily}
          onChange={(daily) => setSettings((current) => ({ ...current, daily }))}
        />
        {settings.daily && (
          <div className="space-y-2 pl-1">
            <Label htmlFor={timeId} className="text-base font-medium">
              {t("notifications.dailyTime")}
            </Label>
            <input
              id={timeId}
              type="time"
              value={settings.dailyTime}
              onChange={(event) => setSettings((current) => ({ ...current, dailyTime: event.target.value }))}
              aria-invalid={timeValid ? undefined : true}
              className={cn(
                "h-14 w-full rounded-xl border border-input bg-background px-4 text-base outline-none sm:w-48",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                "aria-invalid:border-destructive",
              )}
            />
          </div>
        )}
      </div>

      <SwitchRow
        label={t("notifications.weeklyLabel")}
        checked={settings.weekly}
        onChange={(weekly) => setSettings((current) => ({ ...current, weekly }))}
      />
      <SwitchRow
        label={t("notifications.paymentsLabel")}
        checked={settings.payments}
        onChange={(payments) => setSettings((current) => ({ ...current, payments }))}
      />

      <p className="rounded-xl bg-muted p-3 text-sm text-pretty text-muted-foreground">{t("notifications.note")}</p>

      <Button type="submit" className="h-12 w-full text-base sm:w-auto sm:px-8" disabled={saving || !timeValid}>
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
