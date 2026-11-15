import { getTranslations } from "next-intl/server";
import {
  CalculatorGuide,
  CalculatorPage,
  calculatorMetadata,
} from "@/components/calculators/calculator-page";
import { BreakEvenCalculator } from "@/components/calculators/break-even-calculator";

export const generateMetadata = calculatorMetadata("breakEven");

/** /[locale]/break-even-calculator (Part D1, Part F2). */
export default async function BreakEvenCalculatorPage() {
  const t = await getTranslations("calc.breakEven");

  return (
    <CalculatorPage
      id="breakEven"
      guide={
        <CalculatorGuide
          title={t("guideTitle")}
          formula={t("guideFormula")}
          example={t("guideExample")}
        />
      }
    >
      <BreakEvenCalculator />
    </CalculatorPage>
  );
}
