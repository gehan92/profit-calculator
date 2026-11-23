"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { saveRegion } from "@/actions/profile";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isAppLocale, LOCALES, LOCALE_LABELS, type AppLocale } from "@/i18n/config";
import { useRouter } from "@/i18n/navigation";
import { DATE_FORMATS, formatDateAs, type DateFormat } from "@/lib/account/profile";
import { accountTabHref } from "@/lib/account/tabs";
import { Money, SUPPORTED_CURRENCIES } from "@/lib/money";
import { cn } from "@/lib/utils";

const FIELD_CLASS = cn(
  "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
);

/** The value of the "Ask me each time" choice in the currency list. */
const ASK = "ask";

interface RegionFormProps {
  initial: { dateFormat: DateFormat; defaultCurrency: string | null };
  /** A day to show as the date-format example, written "YYYY-MM-DD" (today, from the server). */
  exampleDate: string;
}

/**
 * Account → Language & region: the language of the website for this person,
 * how dates are written in downloaded files, and the currency that is
 * pre-selected when they create a shop. After saving, the page switches to
 * the chosen language.
 */
export function RegionForm({ initial, exampleDate }: RegionFormProps) {
  const t = useTranslations("accountPage");
  const locale = useLocale();
  const router = useRouter();
  const currencyId = useId();

  const [language, setLanguage] = useState<AppLocale>(isAppLocale(locale) ? locale : "en");
  const [dateFormat, setDateFormat] = useState<DateFormat>(initial.dateFormat);
  const [currency, setCurrency] = useState<string>(initial.defaultCurrency ?? ASK);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) return void toast.error(t("common.offline"));

    setSaving(true);
    try {
      const result = await saveRegion({
        locale: language,
        dateFormat,
        defaultCurrency: currency === ASK ? null : (currency as (typeof SUPPORTED_CURRENCIES)[number]),
      });
      if (!result.ok) return void toast.error(t("common.saveFailed"));

      toast.success(t("common.saved"));
      // The page now reads in the chosen language, still on this section.
      if (language !== locale) router.replace(accountTabHref("language"), { locale: language });
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <SegmentedControl
        name="account-language"
        legend={t("language.languageTitle")}
        options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code].full }))}
        value={language}
        onValueChange={setLanguage}
        hint={t("language.languageBody")}
      />

      <SegmentedControl
        name="account-date-format"
        legend={t("language.dateTitle")}
        options={DATE_FORMATS.map((format) => ({ value: format, label: formatDateAs(exampleDate, format) }))}
        value={dateFormat}
        onValueChange={setDateFormat}
        hint={t("language.dateBody", { example: formatDateAs(exampleDate, dateFormat) })}
      />

      <div className="space-y-2">
        <Label htmlFor={currencyId} className="text-base font-medium">
          {t("language.currencyTitle")}
        </Label>
        <select
          id={currencyId}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          aria-describedby={`${currencyId}-note`}
          className={FIELD_CLASS}
        >
          <option value={ASK}>{t("language.currencyAsk")}</option>
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code} · {Money.symbol(isAppLocale(locale) ? locale : "en", code)}
            </option>
          ))}
        </select>
        <p id={`${currencyId}-note`} className="text-sm text-muted-foreground">
          {t("language.currencyBody")}
        </p>
      </div>

      <Button type="submit" className="h-12 w-full text-base sm:w-auto sm:px-8" disabled={saving}>
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
