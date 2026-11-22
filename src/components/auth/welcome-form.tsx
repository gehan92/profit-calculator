"use client";

import { CheckIcon, HouseIcon, ShapesIcon, StoreIcon, TruckIcon, WrenchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { completeShopSetup } from "@/actions/business";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isAppLocale, LOCALE_LABELS, LOCALES, type AppLocale } from "@/i18n/config";
import { Link, useRouter } from "@/i18n/navigation";
import { authRoutes } from "@/lib/auth/routes";
import { SHOP_NAME_MAX_LENGTH } from "@/lib/business/business-repository";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business/business-types";
import { Money, SUPPORTED_CURRENCIES } from "@/lib/money";
import { cn } from "@/lib/utils";

const FIELD_CLASS = cn(
  "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
  "placeholder:text-muted-foreground/70",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
);

const TYPE_ICONS = {
  shop: StoreIcon,
  home: HouseIcon,
  transport: TruckIcon,
  service: WrenchIcon,
  other: ShapesIcon,
} as const satisfies Record<BusinessType, unknown>;

interface WelcomeFormProps {
  /** What is stored now (the defaults made at first login). */
  initial: { name: string; businessType: BusinessType; currency: string };
}

type FieldError = "shopNameRequired" | "shopNameTooLong";

/**
 * "Set up your shop" (Part C1.7), shown once after the first login: shop name,
 * business type, currency and language, then Start. Skipping keeps the
 * defaults ("My Shop", LKR, the current language). The business type chooses
 * which categories the shop starts with.
 */
export function WelcomeForm({ initial }: WelcomeFormProps) {
  const t = useTranslations("welcome");
  const tSettings = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const nameId = useId();
  const currencyId = useId();
  const typeGroup = useId();

  const [name, setName] = useState(initial.name);
  const [businessType, setBusinessType] = useState<BusinessType>(initial.businessType);
  const [currency, setCurrency] = useState(initial.currency);
  const [language, setLanguage] = useState<AppLocale>(isAppLocale(locale) ? locale : "en");
  const [error, setError] = useState<FieldError | null>(null);
  const [saving, setSaving] = useState(false);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("shopNameRequired");
    if (trimmed.length > SHOP_NAME_MAX_LENGTH) return setError("shopNameTooLong");
    setError(null);

    if (!navigator.onLine) {
      toast.error(tSettings("saveFailed"));
      return;
    }

    setSaving(true);
    try {
      const result = await completeShopSetup({ name: trimmed, businessType, currency, locale: language });
      if (!result.ok) {
        if (result.error === "nameRequired") setError("shopNameRequired");
        else if (result.error === "nameTooLong") setError("shopNameTooLong");
        else toast.error(tSettings("saveFailed"));
        setSaving(false);
        return;
      }
      // On to the dashboard, in the language they chose. The button stays "Starting…" until the page changes.
      router.replace(authRoutes.dashboard, { locale: language });
    } catch {
      toast.error(tSettings("saveFailed"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={start} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor={nameId} className="text-base font-medium">
          {tSettings("shopName")}
        </Label>
        <input
          id={nameId}
          type="text"
          value={name}
          maxLength={SHOP_NAME_MAX_LENGTH}
          autoComplete="organization"
          placeholder={t("shopNamePlaceholder")}
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
            {tSettings(error)}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-medium">{t("businessTypeLegend")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUSINESS_TYPES.map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <label
                key={type}
                className={cn(
                  "group relative flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 transition-colors",
                  "hover:bg-muted/60 has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                  type === "other" && "sm:col-span-2",
                )}
              >
                <input
                  type="radio"
                  name={typeGroup}
                  value={type}
                  checked={businessType === type}
                  onChange={() => setBusinessType(type)}
                  className="sr-only"
                />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(`types.${type}.label`)}</span>
                  <span className="block text-sm text-pretty text-muted-foreground">{t(`types.${type}.hint`)}</span>
                </span>
                <CheckIcon
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-primary opacity-0 transition-opacity group-has-checked:opacity-100"
                />
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={currencyId} className="text-base font-medium">
          {tSettings("currency")}
        </Label>
        <select
          id={currencyId}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          aria-describedby={`${currencyId}-note`}
          className={FIELD_CLASS}
        >
          {(SUPPORTED_CURRENCIES as readonly string[]).includes(initial.currency)
            ? SUPPORTED_CURRENCIES.map((code) => <CurrencyOption key={code} code={code} />)
            : [initial.currency, ...SUPPORTED_CURRENCIES].map((code) => <CurrencyOption key={code} code={code} />)}
        </select>
        <p id={`${currencyId}-note`} className="text-sm text-muted-foreground">
          {tSettings("currencyNote")}
        </p>
      </div>

      <SegmentedControl
        name="welcome-language"
        legend={tSettings("language")}
        options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code].full }))}
        value={language}
        onValueChange={setLanguage}
        hint={tSettings("languageNote")}
      />

      <div className="space-y-2 pt-2">
        <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
          {saving ? t("starting") : t("start")}
        </Button>
        <Button asChild variant="ghost" className="h-12 w-full text-base text-muted-foreground">
          <Link href={authRoutes.dashboard}>{t("skip")}</Link>
        </Button>
      </div>
    </form>
  );
}

function CurrencyOption({ code }: { code: string }) {
  const locale = useLocale();
  return (
    <option value={code}>
      {code} · {Money.symbol(isAppLocale(locale) ? locale : "en", code)}
    </option>
  );
}
