import { getTranslations } from "next-intl/server";
import {
  CalculatorGuide,
  CalculatorPage,
  calculatorMetadata,
} from "@/components/calculators/calculator-page";
import { SellingPriceCalculator } from "@/components/calculators/selling-price-calculator";

export const generateMetadata = calculatorMetadata("price");

/** /[locale]/selling-price-calculator (Part D1, Part F2). */
export default async function SellingPriceCalculatorPage() {
  const t = await getTranslations("calc.price");

  return (
    <CalculatorPage
      id="price"
      guide={
        <CalculatorGuide
          title={t("guideTitle")}
          formula={t("guideFormula")}
          example={t("guideExample")}
        />
      }
    >
      <SellingPriceCalculator />
    </CalculatorPage>
  );
}
