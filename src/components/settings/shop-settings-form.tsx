"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { updateShopSettings } from "@/actions/business";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePathname, useRouter } from "@/i18n/navigation";
import { isAppLocale, LOCALES, LOCALE_LABELS, type AppLocale } from "@/i18n/config";
import { SHOP_NAME_MAX_LENGTH } from "@/lib/business/business-repository";
import { Money, SUPPORTED_CURRENCIES } from "@/lib/money";
import { cn } from "@/lib/utils";

const FIELD_CLASS = cn(
  "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
);

interface ShopSettingsFormProps {
  /** What is stored now. */
  initial: { name: string; currency: string };
}

type FieldError = "shopNameRequired" | "shopNameTooLong";

/**
 * Settings → My shop (Part D2): shop name (at most 60 letters), currency and
 * language. After saving, the website switches to the chosen language.
 */
export function ShopSettingsForm({ initial }: ShopSettingsFormProps) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const nameId = useId();
  const currencyId = useId();

  const [name, setName] = useState(initial.name);
  const [currency, setCurrency] = useState(initial.currency);
  const [language, setLanguage] = useState<AppLocale>(isAppLocale(locale) ? locale : "en");
  const [error, setError] = useState<FieldError | null>(null);
  const [saving, setSaving] = useState(false);

  // A stored currency we do not offer any more still shows, so the form never changes it silently.
  const currencies: readonly string[] = (SUPPORTED_CURRENCIES as readonly string[]).includes(initial.currency)
    ? SUPPORTED_CURRENCIES
    : [initial.currency, ...SUPPORTED_CURRENCIES];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("shopNameRequired");
    if (trimmed.length > SHOP_NAME_MAX_LENGTH) return setError("shopNameTooLong");
    setError(null);

    if (!navigator.onLine) {
      toast.error(t("saveFailed"));
      return;
    }

    setSaving(true);
    try {
      const result = await updateShopSettings({ name: trimmed, currency, locale: language });
      if (!result.ok) {
        if (result.error === "nameRequired") setError("shopNameRequired");
        else if (result.error === "nameTooLong") setError("shopNameTooLong");
        else toast.error(t("saveFailed"));
        return;
      }

      setName(trimmed);
      toast.success(t("saved"));
      // The page now reads in the chosen language.
      if (language !== locale) router.replace(pathname, { locale: language });
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor={nameId} className="text-base font-medium">
          {t("shopName")}
        </Label>
        <input
          id={nameId}
          type="text"
          value={name}
          maxLength={SHOP_NAME_MAX_LENGTH}
          autoComplete="organization"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${nameId}-error` : undefined}
          className={FIELD_CLASS}
        />
        {error && (
          <p id={`${nameId}-error`} role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={currencyId} className="text-base font-medium">
          {t("currency")}
        </Label>
        <select
          id={currencyId}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          aria-describedby={`${currencyId}-note`}
          className={FIELD_CLASS}
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code} · {Money.symbol(isAppLocale(locale) ? locale : "en", code)}
            </option>
          ))}
        </select>
        <p id={`${currencyId}-note`} className="text-sm text-muted-foreground">
          {t("currencyNote")}
        </p>
      </div>

      <SegmentedControl
        name="settings-language"
        legend={t("language")}
        options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code].full }))}
        value={language}
        onValueChange={setLanguage}
        hint={t("languageNote")}
      />

      <Button type="submit" className="h-12 w-full text-base sm:w-auto sm:px-8" disabled={saving}>
        {saving ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
