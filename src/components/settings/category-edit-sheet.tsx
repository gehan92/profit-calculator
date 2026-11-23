"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { changeCategory, type CategoryChangeInput } from "@/actions/categories";
import { CATEGORY_COLOR_CLASSES, CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { CategoryView } from "@/lib/categories/category";
import { categoryNameOf } from "@/lib/categories/category-labels";
import { CATEGORY_COLORS, CATEGORY_NAME_MAX } from "@/lib/categories/category-repository";
import { cn } from "@/lib/utils";

interface CategoryEditSheetProps {
  /** The category being changed; `null` keeps the sheet closed. */
  category: CategoryView | null;
  onClose: () => void;
}

/**
 * Change one category (Part D9): its name, its colour, whether it is a hidden
 * cost (costs only) and whether it shows in the list. A default category can
 * be renamed and hidden but never removed; going back to the original name is
 * one tap. Old records keep pointing to the category whatever is changed.
 */
export function CategoryEditSheet({ category, onClose }: CategoryEditSheetProps) {
  const t = useTranslations("categoryManager");

  return (
    <Sheet open={category !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{t("editTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{category?.label}</SheetDescription>
        </SheetHeader>
        {category && <CategoryEditForm key={category.ref} category={category} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function CategoryEditForm({ category, onDone }: { category: CategoryView; onDone: () => void }) {
  const t = useTranslations("categoryManager");
  const tCategory = useTranslations("categories");
  const nameId = useId();
  const hiddenId = useId();
  const showId = useId();

  /** The built-in name of a default category, in this language. */
  const defaultName = category.key ? categoryNameOf(tCategory, category.key) : null;

  const [name, setName] = useState(category.label);
  const [color, setColor] = useState(category.color);
  const [hiddenCost, setHiddenCost] = useState(category.countsAs === "hidden_cost");
  const [visible, setVisible] = useState(!category.archived);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!category.id) return;

    const typed = name.trim();
    // A default category with an empty box, or its original name typed back, returns to the original name.
    const nextName = category.key && (typed === "" || typed === defaultName) ? null : typed;
    if (nextName === "") return setError(t("nameRequired"));

    const change: CategoryChangeInput = {};
    if (nextName !== category.name) change.name = nextName;
    if (color !== category.color) change.color = color;
    if (category.type === "expense" && hiddenCost !== (category.countsAs === "hidden_cost")) change.hiddenCost = hiddenCost;
    if (visible === category.archived) change.archived = !visible;

    if (Object.keys(change).length === 0) return onDone();
    if (!navigator.onLine) return setError(t("offline"));

    setSaving(true);
    setError(null);
    const result = await changeCategory(category.id, change).catch(() => null);
    setSaving(false);

    if (!result?.ok) {
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
                : code === "notAllowed"
                  ? t("notAllowed")
                  : t("saveFailed"),
      );
      return;
    }

    toast.success(t("saved"));
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5 px-4 pb-6">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={category.icon} color={color} className="size-11" />
        <p className="min-w-0 truncate text-lg font-semibold">{typedOrLabel(name, category.label)}</p>
      </div>

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
          enterKeyHint="done"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${nameId}-error` : undefined}
          className={cn(
            "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          )}
        />
        {error && (
          <p id={`${nameId}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {category.key && defaultName && name.trim() !== defaultName && (
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 px-2 py-2 text-left whitespace-normal text-primary"
            onClick={() => {
              setName(defaultName);
              setError(null);
            }}
          >
            {t("useDefaultName", { name: defaultName })}
          </Button>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-medium">{t("colorLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((option) => (
            <label
              key={option}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="category-color"
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

      {category.type === "expense" && (
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

      <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
        <Switch id={showId} checked={visible} onCheckedChange={setVisible} className="mt-1" />
        <div className="min-w-0">
          <Label htmlFor={showId} className="text-base font-medium">
            {t("showLabel")}
          </Label>
          <p className="text-sm text-pretty text-muted-foreground">{t("showHint")}</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-12 sm:px-6" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" className="h-12 sm:px-8" disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

/** The heading shows what is typed so far, or the current name while the box is empty. */
function typedOrLabel(typed: string, label: string): string {
  return typed.trim() === "" ? label : typed.trim();
}
