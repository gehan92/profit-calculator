import { getTranslations } from "next-intl/server";
import {
  CalculatorGuide,
  CalculatorPage,
  calculatorMetadata,
} from "@/components/calculators/calculator-page";
import { MarginCalculator } from "@/components/calculators/margin-calculator";

export const generateMetadata = calculatorMetadata("margin");

/** /[locale]/margin-calculator (Part D1, Part F2). */
export default async function MarginCalculatorPage() {
  const t = await getTranslations("calc.margin");

  return (
    <CalculatorPage
      id="margin"
      guide={
        <CalculatorGuide
          title={t("guideTitle")}
          formula={t("guideFormula")}
          example={t("guideExample")}
        />
      }
    >
      <MarginCalculator />
    </CalculatorPage>
  );
}
