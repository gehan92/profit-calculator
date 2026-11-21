"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { dashboardRoutes } from "@/lib/roles";

const BIG_BUTTON = "h-auto min-h-14 py-3 text-base leading-tight whitespace-normal";

/**
 * "[ + Income ]  [ − Expense ]" (Part C2 Owner home and Staff today).
 * Each opens Add entry with that type already chosen.
 */
export function AddButtons() {
  const t = useTranslations("entry");

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button asChild className={BIG_BUTTON}>
        <Link href={`${dashboardRoutes.add}?type=income`}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {t("income")}
        </Link>
      </Button>
      <Button asChild variant="outline" className={`${BIG_BUTTON} bg-background`}>
        <Link href={`${dashboardRoutes.add}?type=expense`}>
          <MinusIcon data-icon="inline-start" aria-hidden="true" className="text-loss" />
          {t("expense")}
        </Link>
      </Button>
    </div>
  );
}
