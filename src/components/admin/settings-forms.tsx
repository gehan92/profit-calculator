"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { updateSetting } from "@/actions/admin/settings";
import { Panel } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TypedConfirmDialog } from "@/components/ui/typed-confirm-dialog";
import { LOCALE_LABELS, LOCALES, type AppLocale } from "@/i18n/config";
import type { AppSettings, SettingKey } from "@/lib/admin/app-settings";
import { CONFIRM_WORD, matchesTyped } from "@/lib/admin/user-rules";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { cn } from "@/lib/utils";

const FIELD = cn(
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
);

/** Saves one setting and tells the admin what happened. Returns true when it was saved. */
function useSaveSetting() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function save(key: SettingKey, value: unknown, done = "Saved"): Promise<boolean> {
    setBusy(true);
    try {
      const result = await updateSetting(key, value);
      if (!result.ok) {
        toast.error(
          result.error === "invalid"
            ? "That value is not allowed. Please check it."
            : result.error === "notAllowed"
              ? "You are not allowed to change settings."
              : "It did not work. Please try again.",
        );
        return false;
      }
      toast.success(done);
      if (!result.auditSaved) toast.warning("Saved, but the audit log row could not be saved.");
      router.refresh();
      return true;
    } catch {
      toast.error("It did not work. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { save, busy };
}

function SaveButton({ busy }: { busy: boolean }) {
  return (
    <Button type="submit" className="h-11 px-6" disabled={busy}>
      {busy ? "Saving…" : "Save"}
    </Button>
  );
}

// ------------------------------------------------------------------ maintenance

/**
 * Maintenance mode (Part D4, Part C2): calculators keep working and My Business
 * shows "Back soon". Switching it ON asks you to type CONFIRM, because it
 * affects every shop owner at once (Part C1.6).
 */
export function MaintenanceSection({ initial }: { initial: AppSettings["maintenance"] }) {
  const { save, busy } = useSaveSetting();
  const switchId = useId();
  const [asking, setAsking] = useState(false);

  async function turnOn() {
    if (await save("maintenance", { on: true }, "Maintenance mode is ON")) setAsking(false);
  }

  return (
    <Panel
      title="Maintenance mode"
      description="While it is ON, the calculators still work and My Business shows a “Back soon” banner. Shop owners can still see and add records."
    >
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Label htmlFor={switchId} className="text-base font-medium">
          Maintenance mode is {initial.on ? "ON" : "OFF"}
        </Label>
        <Switch
          id={switchId}
          checked={initial.on}
          disabled={busy}
          onCheckedChange={(checked) => {
            if (checked) setAsking(true);
            else void save("maintenance", { on: false }, "Maintenance mode is OFF");
          }}
        />
      </div>

      <TypedConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title="Turn on maintenance mode?"
        description="Every shop owner will see a “Back soon” banner on My Business until you turn it off."
        typeLabel={`Type ${CONFIRM_WORD}`}
        placeholder={CONFIRM_WORD}
        isConfirmed={(typed) => matchesTyped(typed, CONFIRM_WORD)}
        confirmLabel="Turn on"
        cancelLabel="Cancel"
        busyLabel="Turning on…"
        busy={busy}
        destructive
        onConfirm={() => void turnOn()}
      />
    </Panel>
  );
}

// -------------------------------------------------------------- feature flags

const FEATURE_LABELS: Record<keyof AppSettings["features"], { label: string; hint: string }> = {
  products: { label: "Products", hint: "Products and margins for shop owners" },
  team: { label: "Team", hint: "Invite Staff and Viewers (Pro)" },
  pdf: { label: "PDF reports", hint: "Download reports as PDF" },
};

/** Feature flags: screens that can be switched off for everyone. */
export function FeaturesSection({ initial }: { initial: AppSettings["features"] }) {
  const { save, busy } = useSaveSetting();
  const [flags, setFlags] = useState(initial);
  const idBase = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save("features", flags);
  }

  return (
    <Panel title="Feature flags" description="Switch a feature off for every shop.">
      <form onSubmit={submit} className="space-y-3">
        {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((key) => (
          <div key={key} className="flex min-h-11 items-center justify-between gap-4">
            <div>
              <Label htmlFor={`${idBase}-${key}`} className="text-base font-medium">
                {FEATURE_LABELS[key].label}
              </Label>
              <p className="text-xs text-muted-foreground">{FEATURE_LABELS[key].hint}</p>
            </div>
            <Switch id={`${idBase}-${key}`} checked={flags[key]} onCheckedChange={(checked) => setFlags({ ...flags, [key]: checked })} />
          </div>
        ))}
        <SaveButton busy={busy} />
      </form>
    </Panel>
  );
}

// ------------------------------------------------------------------ pro limits

/** Pro plan limits per shop (Part D3: up to 3 Staff and 2 Viewers). */
export function ProLimitsSection({ initial }: { initial: AppSettings["pro_limits"] }) {
  const { save, busy } = useSaveSetting();
  const [staff, setStaff] = useState(String(initial.staff));
  const [viewers, setViewers] = useState(String(initial.viewers));
  const staffId = useId();
  const viewersId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save("pro_limits", { staff: Number(staff), viewers: Number(viewers) });
  }

  return (
    <Panel title="Pro limits" description="How many people a Pro shop can invite.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberBox id={staffId} label="Staff per shop" value={staff} onChange={setStaff} />
          <NumberBox id={viewersId} label="Viewers per shop" value={viewers} onChange={setViewers} />
        </div>
        <SaveButton busy={busy} />
      </form>
    </Panel>
  );
}

function NumberBox({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
      </Label>
      <input id={id} type="number" inputMode="numeric" min={0} max={50} step={1} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD} />
    </div>
  );
}

// -------------------------------------------------------------------- defaults

/** The language and currency a new shop starts with (Part D4: "defaults (language, currency)"). */
export function DefaultsSection({ initial }: { initial: AppSettings["defaults"] }) {
  const { save, busy } = useSaveSetting();
  const [locale, setLocale] = useState<AppLocale>(initial.locale);
  const [currency, setCurrency] = useState<string>(initial.currency);
  const localeId = useId();
  const currencyId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save("defaults", { locale, currency });
  }

  return (
    <Panel title="Defaults for new shops" description="What a shop starts with the first time its owner logs in.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={localeId} className="text-base font-medium">
              Language
            </Label>
            <select id={localeId} value={locale} onChange={(event) => setLocale(event.target.value as AppLocale)} className={FIELD}>
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_LABELS[code].full}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={currencyId} className="text-base font-medium">
              Currency
            </Label>
            <select id={currencyId} value={currency} onChange={(event) => setCurrency(event.target.value)} className={FIELD}>
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>
        <SaveButton busy={busy} />
      </form>
    </Panel>
  );
}

// -------------------------------------------------------------- support number

/** The number behind the “WhatsApp support” button. Empty hides the button. */
export function SupportNumberSection({ initial }: { initial: AppSettings["support"] }) {
  const { save, busy } = useSaveSetting();
  const [number, setNumber] = useState(initial.whatsapp);
  const id = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save("support", { whatsapp: number });
  }

  return (
    <Panel title="Support WhatsApp number" description="Shown on the “Your account is paused” screen and the feedback page. Leave it empty to hide the button.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={id} className="text-base font-medium">
            WhatsApp number
          </Label>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="+94 77 123 4567"
            className={cn(FIELD, "sm:max-w-sm")}
          />
        </div>
        <SaveButton busy={busy} />
      </form>
    </Panel>
  );
}

/** Lays the settings sections out in one column. */
export function SettingsStack({ children }: { children: ReactNode }) {
  return <div className="max-w-2xl space-y-4">{children}</div>;
}
