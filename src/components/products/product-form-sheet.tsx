"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { saveProduct, setProductArchived, type ProductActionError } from "@/actions/products";
import { MoneyInput } from "@/components/calculators/number-field";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Money } from "@/lib/money";
import {
  COMPANY_NAME_MAX,
  PRODUCT_BARCODE_MAX,
  PRODUCT_NAME_MAX,
  PRODUCT_NOTES_MAX,
  PRODUCT_UNITS,
  productFieldsSchema,
  productMargin,
  suggestCompanies,
  type Product,
  type ProductKind,
  type ProductUnit,
} from "@/lib/products/product";
import { cn } from "@/lib/utils";

interface ProductFormSheetProps {
  /** The product being changed, `"new"` for a new one, or `null` to keep the sheet closed. */
  product: Product | "new" | null;
  /** Company names used before, offered as the owner types. */
  companyNames: readonly string[];
  /** The kind chosen first for a new product (the tab the owner was on). */
  defaultKind: ProductKind;
  onClose: () => void;
}

/**
 * Add or change a product (Part D8): where it comes from, name, company,
 * unit, cost and price, with the profit and margin shown live as the numbers
 * are typed. Putting a product away (instead of deleting) keeps old records
 * readable. The server and database check everything again.
 */
export function ProductFormSheet({ product, companyNames, defaultKind, onClose }: ProductFormSheetProps) {
  const t = useTranslations("products");

  return (
    <Sheet open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">
            {product === "new" ? t("formAddTitle") : t("formEditTitle")}
          </SheetTitle>
          <SheetDescription className="sr-only">{product && product !== "new" ? product.name : t("formAddTitle")}</SheetDescription>
        </SheetHeader>
        {product && (
          <ProductForm
            key={product === "new" ? "new" : product.id}
            product={product === "new" ? null : product}
            companyNames={companyNames}
            defaultKind={defaultKind}
            onDone={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type FieldName = "name" | "company" | "cost" | "price" | "barcode" | "notes";

const FIELD_OF_ERROR: Partial<Record<ProductActionError, FieldName>> = {
  nameRequired: "name",
  nameTooLong: "name",
  nameTaken: "name",
  companyRequired: "company",
  companyTooLong: "company",
  barcodeTooLong: "barcode",
  notesTooLong: "notes",
};

const INPUT_CLASS = cn(
  "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
  "placeholder:text-muted-foreground/70",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
);

function ProductForm({
  product,
  companyNames,
  defaultKind,
  onDone,
}: {
  product: Product | null;
  companyNames: readonly string[];
  defaultKind: ProductKind;
  onDone: () => void;
}) {
  const t = useTranslations("products");
  const tUnits = useTranslations("units");
  const { money, percent } = useCalcFormat();
  const ids = { name: useId(), company: useId(), unit: useId(), cost: useId(), price: useId(), barcode: useId(), notes: useId() };

  const [kind, setKind] = useState<ProductKind>(product?.kind ?? defaultKind);
  const [name, setName] = useState(product?.name ?? "");
  const [company, setCompany] = useState(product?.companyName ?? "");
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? "piece");
  const [cost, setCost] = useState(product ? Money.fromCents(product.costCents).toInputString() : "");
  const [price, setPrice] = useState(product ? Money.fromCents(product.priceCents).toInputString() : "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmingPutAway, setConfirmingPutAway] = useState(false);

  const costCents = Money.parse(cost)?.cents ?? 0;
  const priceCents = Money.parse(price)?.cents ?? 0;
  const live = productMargin({ costCents, priceCents });
  const suggestions = kind === "company" ? suggestCompanies(companyNames, company) : [];

  function messageFor(code: ProductActionError): string {
    switch (code) {
      case "nameRequired":
      case "nameTooLong":
      case "companyRequired":
      case "companyTooLong":
      case "invalidAmount":
      case "barcodeTooLong":
      case "notesTooLong":
      case "limitReached":
      case "nameTaken":
      case "tooMany":
      case "notAllowed":
      case "notFound":
        return t(code);
      default:
        return t("saveFailed");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = productFieldsSchema.safeParse({
      name,
      kind,
      companyName: company,
      unit,
      costCents,
      priceCents,
      barcode,
      notes,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const code = (issue?.message ?? "invalid") as ProductActionError;
      const path = String(issue?.path[0] ?? "");
      const field: FieldName =
        path === "costCents" ? "cost" : path === "priceCents" ? "price" : (FIELD_OF_ERROR[code] ?? "name");
      return setErrors({ [field]: messageFor(code) });
    }
    if (!navigator.onLine) return toast.error(t("offline"));

    setSaving(true);
    setErrors({});
    const result = await saveProduct(product?.id ?? null, parsed.data).catch(() => null);
    setSaving(false);

    if (!result?.ok) {
      const code: ProductActionError = result && !result.ok ? result.error : "saveFailed";
      const field = FIELD_OF_ERROR[code];
      if (field) setErrors({ [field]: messageFor(code) });
      else toast.error(messageFor(code));
      return;
    }
    toast.success(t("saved"));
    onDone();
  }

  async function setArchived(archived: boolean) {
    if (!product) return;
    setConfirmingPutAway(false);
    if (!navigator.onLine) return toast.error(t("offline"));

    setSaving(true);
    const result = await setProductArchived(product.id, archived).catch(() => null);
    setSaving(false);

    if (!result?.ok) return toast.error(messageFor(result && !result.ok ? result.error : "saveFailed"));
    toast.success(archived ? t("putAwayDone") : t("broughtBack"));
    onDone();
  }

  const unitLabel = tUnits(unit);

  return (
    <form onSubmit={submit} noValidate className="space-y-5 px-4 pb-6">
      <SegmentedControl
        name="product-kind"
        legend={t("kindLegend")}
        options={[
          { value: "own", label: t("kindOwn") },
          { value: "company", label: t("kindCompany") },
        ]}
        value={kind}
        onValueChange={setKind}
      />

      <Field id={ids.name} label={t("nameLabel")} error={errors.name}>
        <input
          id={ids.name}
          type="text"
          value={name}
          maxLength={PRODUCT_NAME_MAX}
          autoComplete="off"
          placeholder={kind === "own" ? t("namePlaceholderOwn") : t("namePlaceholderCompany")}
          onChange={(event) => {
            setName(event.target.value);
            setErrors((previous) => ({ ...previous, name: undefined }));
          }}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${ids.name}-error` : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      {kind === "company" && (
        <Field id={ids.company} label={t("companyLabel")} error={errors.company}>
          <input
            id={ids.company}
            type="text"
            value={company}
            maxLength={COMPANY_NAME_MAX}
            autoComplete="off"
            placeholder={t("companyPlaceholder")}
            onChange={(event) => {
              setCompany(event.target.value);
              setErrors((previous) => ({ ...previous, company: undefined }));
            }}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={errors.company ? `${ids.company}-error` : undefined}
            className={INPUT_CLASS}
          />
          {suggestions.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-1" aria-label={t("companyLabel")}>
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => setCompany(suggestion)}
                    className="min-h-11 rounded-full border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
      )}

      <Field id={ids.unit} label={t("unitLabel")}>
        <select
          id={ids.unit}
          value={unit}
          onChange={(event) => setUnit(event.target.value as ProductUnit)}
          className={INPUT_CLASS}
        >
          {PRODUCT_UNITS.map((option) => (
            <option key={option} value={option}>
              {tUnits(option)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput
          id={ids.cost}
          label={t("costLabel")}
          value={cost}
          onValueChange={(value) => {
            setCost(value);
            setErrors((previous) => ({ ...previous, cost: undefined }));
          }}
          invalid={Boolean(errors.cost)}
          hint={errors.cost}
        />
        <MoneyInput
          id={ids.price}
          label={t("priceLabel")}
          value={price}
          onValueChange={(value) => {
            setPrice(value);
            setErrors((previous) => ({ ...previous, price: undefined }));
          }}
          invalid={Boolean(errors.price)}
          hint={errors.price}
        />
      </div>

      {/* Live margin: the same formulas as the margin calculator (Part D1). */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "space-y-1 rounded-xl border p-4",
          priceCents === 0 ? "bg-card" : live.perItemCents < 0 ? "border-loss/40 bg-loss/10" : "border-profit/40 bg-profit/10",
        )}
      >
        <p className="text-sm font-medium text-muted-foreground">{t("marginTitle", { unit: unitLabel })}</p>
        {priceCents === 0 ? (
          <p className="text-sm text-pretty">{t("marginUnknown")}</p>
        ) : live.perItemCents < 0 ? (
          <p className="money text-lg font-semibold text-loss">{t("marginLoss", { amount: money(Math.abs(live.perItemCents)), unit: unitLabel })}</p>
        ) : (
          <>
            <p className="money text-xl font-bold text-profit">{t("marginProfit", { amount: money(live.perItemCents) })}</p>
            <p className="money text-sm text-muted-foreground">
              {live.marginPct !== null && t("marginPct", { percent: percent(live.marginPct) })}
              {live.markupPct !== null && ` · ${t("markup", { percent: percent(live.markupPct) })}`}
            </p>
          </>
        )}
      </div>

      <Field id={ids.barcode} label={t("barcodeLabel")} error={errors.barcode}>
        <input
          id={ids.barcode}
          type="text"
          inputMode="numeric"
          value={barcode}
          maxLength={PRODUCT_BARCODE_MAX}
          autoComplete="off"
          onChange={(event) => {
            setBarcode(event.target.value);
            setErrors((previous) => ({ ...previous, barcode: undefined }));
          }}
          aria-invalid={errors.barcode ? true : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      <Field id={ids.notes} label={t("notesLabel")} error={errors.notes}>
        <input
          id={ids.notes}
          type="text"
          value={notes}
          maxLength={PRODUCT_NOTES_MAX}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => {
            setNotes(event.target.value);
            setErrors((previous) => ({ ...previous, notes: undefined }));
          }}
          aria-invalid={errors.notes ? true : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      <div className="space-y-2 pt-1">
        <Button type="submit" className="h-14 w-full text-base" disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
        {product &&
          (product.archived ? (
            <Button type="button" variant="outline" className="h-12 w-full bg-background text-base" disabled={saving} onClick={() => void setArchived(false)}>
              {t("bringBack")}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-12 w-full bg-background text-base" disabled={saving} onClick={() => setConfirmingPutAway(true)}>
              {t("putAway")}
            </Button>
          ))}
      </div>

      {product && (
        <ConfirmDialog
          open={confirmingPutAway}
          onOpenChange={setConfirmingPutAway}
          title={t("putAwayTitle", { name: product.name })}
          description={t("putAwayBody")}
          confirmLabel={t("putAwayConfirm")}
          cancelLabel={t("cancel")}
          onConfirm={() => void setArchived(true)}
        />
      )}
    </form>
  );
}

/** A label, the field and its error text. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
