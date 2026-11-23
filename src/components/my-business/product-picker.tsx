"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/products/product";
import { formatQuantity, isQuantityInput, parseQuantity, stepQuantity } from "@/lib/products/quantity";
import { cn } from "@/lib/utils";

interface ProductPickerProps {
  /** The products to offer (put-away ones are left out by the caller, except the one already chosen). */
  products: readonly Product[];
  productId: string | null;
  /** What is typed in the quantity box. */
  quantity: string;
  onProductChange: (productId: string | null) => void;
  onQuantityChange: (quantity: string) => void;
  /** Error under the quantity box. */
  error?: string;
  /** What the amount was worked out from, e.g. "Rs 650 × 3". */
  hint?: string;
}

const FIELD_CLASS = cn(
  "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
);

const STEP_BUTTON_CLASS = cn(
  "flex size-14 shrink-0 items-center justify-center rounded-xl border border-input bg-background transition-colors",
  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
);

/**
 * "Product (optional)" and "Quantity" in Add entry (Part D8): choosing a
 * product fills in the amount from its price (sales) or cost (purchases) times
 * the quantity, and the entry remembers the product for the best and worst
 * product lists. A plain list (not a search box) keeps it easy on a phone.
 */
export function ProductPicker({
  products,
  productId,
  quantity,
  onProductChange,
  onQuantityChange,
  error,
  hint,
}: ProductPickerProps) {
  const t = useTranslations("entry");
  const tUnits = useTranslations("units");
  const selectId = useId();
  const quantityId = useId();

  const chosen = products.find((product) => product.id === productId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={selectId} className="text-base font-medium">
          {t("product")}
        </Label>
        <select
          id={selectId}
          value={productId ?? ""}
          onChange={(event) => onProductChange(event.target.value || null)}
          className={FIELD_CLASS}
        >
          <option value="">{t("productNone")}</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.companyName ? ` · ${product.companyName}` : ""}
              {product.archived ? ` (${t("productPutAway")})` : ""}
            </option>
          ))}
        </select>
      </div>

      {chosen && (
        <div className="space-y-2">
          <Label htmlFor={quantityId} className="text-base font-medium">
            {t("quantity")}
          </Label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={STEP_BUTTON_CLASS}
              aria-label={t("quantityLess")}
              onClick={() => onQuantityChange(formatQuantity(stepQuantity(parseQuantity(quantity), chosen.unit, -1)))}
            >
              <MinusIcon aria-hidden="true" className="size-5" />
            </button>
            <input
              id={quantityId}
              type="text"
              inputMode="decimal"
              value={quantity}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(event) => isQuantityInput(event.target.value) && onQuantityChange(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${quantityId}-error` : hint ? `${quantityId}-hint` : undefined}
              className={cn(FIELD_CLASS, "money min-w-0 text-center", "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20")}
            />
            <button
              type="button"
              className={STEP_BUTTON_CLASS}
              aria-label={t("quantityMore")}
              onClick={() => onQuantityChange(formatQuantity(stepQuantity(parseQuantity(quantity), chosen.unit, 1)))}
            >
              <PlusIcon aria-hidden="true" className="size-5" />
            </button>
            <span className="w-16 shrink-0 text-sm text-pretty text-muted-foreground">{tUnits(chosen.unit)}</span>
          </div>
          {error ? (
            <p id={`${quantityId}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            hint && (
              <p id={`${quantityId}-hint`} className="text-sm text-muted-foreground">
                {hint}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
