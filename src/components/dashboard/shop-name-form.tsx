"use client";

import { StoreIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { renameShop } from "@/actions/business";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authRoutes } from "@/lib/auth/routes";
import { SHOP_NAME_MAX_LENGTH } from "@/lib/business/business-repository";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * "What is your shop called?" — asked once after the first login (Part D2).
 * Skippable: "Skip" just goes to the dashboard and keeps the default name.
 */
export function ShopNameForm({ businessId }: { businessId: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [result, formAction, pending] = useActionState(renameShop, null);
  const error = result && !result.ok ? t(result.error) : null;

  return (
    <section
      aria-labelledby="shop-name-title"
      className="rounded-2xl border-2 border-primary/30 bg-background p-5 sm:p-6"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <StoreIcon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 id="shop-name-title" className="text-lg font-semibold">
            {t("shopNameTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("shopNameHint")}</p>
        </div>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="locale" value={locale} />
        <Label htmlFor="shop-name" className="sr-only">
          {t("shopNameLabel")}
        </Label>
        <input
          id="shop-name"
          name="name"
          type="text"
          autoComplete="organization"
          maxLength={SHOP_NAME_MAX_LENGTH}
          placeholder={t("shopNameLabel")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "shop-name-error" : undefined}
          className={cn(
            "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
            "placeholder:text-muted-foreground/70",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          )}
        />
        {error && (
          <p id="shop-name-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link href={authRoutes.dashboard}>{t("skip")}</Link>
          </Button>
        </div>
      </form>
    </section>
  );
}
