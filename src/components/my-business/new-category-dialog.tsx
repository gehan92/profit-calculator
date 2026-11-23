"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createCategory } from "@/actions/categories";
import { CATEGORY_COLOR_CLASSES } from "@/components/category-icon";
import { useAddCategory } from "@/components/shop-catalog-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EntryCategoryType } from "@/config/categories";
import type { CategoryRow } from "@/lib/categories/category";
import { CATEGORY_COLORS, CATEGORY_NAME_MAX, type CategoryColor } from "@/lib/categories/category-repository";
import { cn } from "@/lib/utils";

interface NewCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Money in or money out: an own category belongs to one of them. */
  type: EntryCategoryType;
  /** Called with the new category once it is saved. */
  onCreated: (category: CategoryRow) => void;
}

/**
 * "+ New category" (Part D9): a name, a colour and, for a cost, whether it is
 * a hidden cost. Used in Add entry (so a new kind of cost never stops a
 * record) and in Settings → Categories. Own categories are free and unlimited.
 */
export function NewCategoryDialog({ open, onOpenChange, type, onCreated }: NewCategoryDialogProps) {
  const t = useTranslations("categoryManager");
  const addToCatalog = useAddCategory();
  const nameId = useId();
  const hiddenId = useId();

  const [name, setName] = useState("");
  const [hiddenCost, setHiddenCost] = useState(false);
  const [color, setColor] = useState<CategoryColor>("gray");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setHiddenCost(false);
    setColor("gray");
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation(); // This form sits inside the Add entry form: never submit that one too.
    const trimmed = name.trim();
    if (!trimmed) return setError(t("nameRequired"));
    if (!navigator.onLine) return setError(t("offline"));

    setSaving(true);
    setError(null);
    const result = await createCategory({ type, name: trimmed, hiddenCost: type === "expense" && hiddenCost, color }).catch(() => null);
    setSaving(false);

    if (!result?.ok || !result.category) {
      const code = result && !result.ok ? result.error : "saveFailed";
      setError(
        code === "nameTaken"
          ? t("nameTaken")
          : code === "nameTooLong"
            ? t("nameTooLong")
            : code === "nameRequired"
              ? t("nameRequired")
              : code === "tooMany"
                ? t("tooMany")
                : t("saveFailed"),
      );
      return;
    }

    addToCatalog(result.category);
    onCreated(result.category);
    toast.success(t("created", { name: trimmed }));
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("newTitle")}</DialogTitle>
          <DialogDescription>{type === "income" ? t("newBodyIncome") : t("newBodyExpense")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={nameId} className="text-base font-medium">
              {t("nameLabel")}
            </Label>
            <input
              id={nameId}
              type="text"
              value={name}
              maxLength={CATEGORY_NAME_MAX}
              autoComplete="off"
              autoFocus
              enterKeyHint="done"
              placeholder={type === "income" ? t("placeholderIncome") : t("placeholderExpense")}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${nameId}-error` : undefined}
              className={cn(
                "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
                "placeholder:text-muted-foreground/70",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
              )}
            />
            {error && (
              <p id={`${nameId}-error`} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-base font-medium">{t("colorLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors",
                    "has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  )}
                >
                  <input
                    type="radio"
                    name="new-category-color"
                    value={option}
                    checked={color === option}
                    onChange={() => setColor(option)}
                    className="sr-only"
                  />
                  <span className={cn("size-7 rounded-full", CATEGORY_COLOR_CLASSES[option])} />
                  <span className="sr-only">{t(`colors.${option}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {type === "expense" && (
            <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
              <Switch id={hiddenId} checked={hiddenCost} onCheckedChange={setHiddenCost} className="mt-1" />
              <div className="min-w-0">
                <Label htmlFor={hiddenId} className="text-base font-medium">
                  {t("hiddenLabel")}
                </Label>
                <p className="text-sm text-pretty text-muted-foreground">{t("hiddenHint")}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-12" disabled={saving}>
              {saving ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
