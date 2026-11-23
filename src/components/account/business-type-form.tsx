"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { saveBusinessType } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business/business-types";
import { cn } from "@/lib/utils";

/**
 * Account → Profile → type of business (Owner only). The same five choices as
 * shop setup. Picking another type adds that type's default categories to the
 * shop; nothing is ever removed.
 */
export function BusinessTypeForm({ initial }: { initial: BusinessType }) {
  const t = useTranslations("accountPage");
  const tTypes = useTranslations("welcome.types");
  const name = useId();
  const [chosen, setChosen] = useState<BusinessType>(initial);
  const [saved, setSaved] = useState<BusinessType>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!navigator.onLine) return void toast.error(t("common.offline"));
    setSaving(true);
    try {
      const result = await saveBusinessType(chosen);
      if (result.ok) {
        setSaved(chosen);
        toast.success(t("common.saved"));
      } else {
        toast.error(t("common.saveFailed"));
      }
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="sr-only">{t("profile.businessTitle")}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BUSINESS_TYPES.map((type) => (
          <label
            key={type}
            className={cn(
              "flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border bg-background px-4 py-2 transition-colors",
              "has-checked:border-primary has-checked:bg-primary-soft",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={type}
              checked={chosen === type}
              onChange={() => setChosen(type)}
              className="sr-only"
            />
            <span className="font-medium">{tTypes(`${type}.label`)}</span>
            <span className="text-sm text-muted-foreground">{tTypes(`${type}.hint`)}</span>
          </label>
        ))}
      </div>
      <Button
        type="button"
        className="h-12 w-full text-base sm:w-auto sm:px-8"
        disabled={saving || chosen === saved}
        onClick={() => void save()}
      >
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </fieldset>
  );
}
