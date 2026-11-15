import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CALCULATORS, type CalculatorId } from "@/config/calculators";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CalculatorIcon } from "./calculator-icon";

interface CalculatorGridProps {
  /** Leave out the calculator the user is already on ("links to the other tools", Part F4.5). */
  exclude?: CalculatorId;
}

export async function CalculatorGrid({ exclude }: CalculatorGridProps) {
  const t = await getTranslations("calc");
  const calculators = CALCULATORS.filter((calculator) => calculator.id !== exclude);

  return (
    <ul
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        calculators.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      {calculators.map((calculator) => (
        <li key={calculator.id}>
          <Link
            href={calculator.href}
            className="group flex h-full flex-col gap-4 rounded-xl border bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <CalculatorIcon id={calculator.id} className="size-5" />
            </span>
            <span className="space-y-1">
              <span className="block text-lg font-semibold">{t(`${calculator.id}.name`)}</span>
              <span className="block text-sm text-muted-foreground">
                {t(`${calculator.id}.description`)}
              </span>
            </span>
            <ArrowRightIcon
              aria-hidden="true"
              className="mt-auto size-5 text-primary transition-transform group-hover:translate-x-1"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
