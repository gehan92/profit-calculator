import { getTranslations } from "next-intl/server";
import {
  CalculatorGuide,
  CalculatorPage,
  calculatorMetadata,
} from "@/components/calculators/calculator-page";
import { ProfitCalculator } from "@/components/calculators/profit-calculator";

export const generateMetadata = calculatorMetadata("profit");

/** /[locale]/profit-calculator (Part D1, Part F2). */
export default async function ProfitCalculatorPage() {
  const t = await getTranslations("calc.profit");

  return (
    <CalculatorPage
      id="profit"
      guide={
        <CalculatorGuide
          title={t("guideTitle")}
          formula={t("guideFormula")}
          example={t("guideExample")}
        />
      }
    >
      <ProfitCalculator />
    </CalculatorPage>
  );
}
