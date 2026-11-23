"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { saveProfileName } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PROFILE_NAME_MAX_LENGTH } from "@/lib/account/profile";
import { cn } from "@/lib/utils";

const FIELD_CLASS = cn(
  "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
);

/** Account → Profile → name: at most 80 letters, optional. Shown only to the person. */
export function NameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("accountPage");
  const id = useId();
  const [name, setName] = useState(initialName);
  const [tooLong, setTooLong] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length > PROFILE_NAME_MAX_LENGTH) return setTooLong(true);
    setTooLong(false);
    if (!navigator.onLine) return void toast.error(t("common.offline"));

    setSaving(true);
    try {
      const result = await saveProfileName(name);
      if (result.ok) {
        setName(name.trim());
        toast.success(t("common.saved"));
      } else if (result.error === "invalid") {
        setTooLong(true);
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
    <form onSubmit={save} className="space-y-3" noValidate>
      <div className="space-y-2">
        <Label htmlFor={id} className="text-base font-medium">
          {t("profile.nameLabel")}
        </Label>
        <input
          id={id}
          type="text"
          value={name}
          maxLength={PROFILE_NAME_MAX_LENGTH + 20}
          autoComplete="name"
          placeholder={t("profile.namePlaceholder")}
          onChange={(event) => {
            setName(event.target.value);
            setTooLong(false);
          }}
          aria-invalid={tooLong ? true : undefined}
          aria-describedby={`${id}-help`}
          className={FIELD_CLASS}
        />
        <p id={`${id}-help`} className={cn("text-sm", tooLong ? "text-destructive" : "text-muted-foreground")} role={tooLong ? "alert" : undefined}>
          {tooLong ? t("profile.nameTooLong") : t("profile.nameHelp")}
        </p>
      </div>
      <Button type="submit" className="h-12 w-full text-base sm:w-auto sm:px-8" disabled={saving}>
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
