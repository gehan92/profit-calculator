import {
  BoxIcon,
  ChefHatIcon,
  DropletIcon,
  EllipsisIcon,
  FuelIcon,
  HeartIcon,
  HouseIcon,
  PackageIcon,
  PlusIcon,
  ShoppingCartIcon,
  TagIcon,
  Trash2Icon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  WifiIcon,
  WrenchIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** The icon names the database stores (`categories.icon`) and the pictures they show. */
const ICONS: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCartIcon,
  tool: WrenchIcon,
  plus: PlusIcon,
  package: PackageIcon,
  "chef-hat": ChefHatIcon,
  "gas-station": FuelIcon,
  home: HouseIcon,
  users: UsersIcon,
  bolt: ZapIcon,
  droplet: DropletIcon,
  wifi: WifiIcon,
  truck: TruckIcon,
  heart: HeartIcon,
  user: UserIcon,
  trash: Trash2Icon,
  dots: EllipsisIcon,
  box: BoxIcon,
  tag: TagIcon,
};

/**
 * The colours the database stores (`categories.color`). Written out in full so
 * Tailwind keeps every class; the pairs have enough contrast for small icons.
 */
export const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800",
  orange: "bg-orange-100 text-orange-800",
  blue: "bg-sky-100 text-sky-800",
  yellow: "bg-amber-100 text-amber-800",
  purple: "bg-violet-100 text-violet-800",
  red: "bg-rose-100 text-rose-800",
  gray: "bg-muted text-muted-foreground",
};

/** A category's picture on its colour, e.g. a truck on grey for Transport. Unknown names show a tag. */
export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? TagIcon;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
        CATEGORY_COLOR_CLASSES[color] ?? CATEGORY_COLOR_CLASSES.gray,
        className,
      )}
    >
      <Icon className="size-[1.125rem]" />
    </span>
  );
}
