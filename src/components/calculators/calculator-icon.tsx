import { PercentIcon, ScaleIcon, TagIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import type { CalculatorId } from "@/config/calculators";

const ICONS: Record<CalculatorId, LucideIcon> = {
  profit: TrendingUpIcon,
  margin: PercentIcon,
  price: TagIcon,
  breakEven: ScaleIcon,
};

export function CalculatorIcon({ id, className }: { id: CalculatorId; className?: string }) {
  const Icon = ICONS[id];
  return <Icon aria-hidden="true" className={className} />;
}
