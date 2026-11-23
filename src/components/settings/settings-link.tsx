import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ACCOUNT_PATH } from "@/lib/account/tabs";
import type { DashboardRoute } from "@/lib/roles";

/** A tile on Settings that opens one of the shop's lists (Categories, Products) or the Account page. */
export function SettingsLink({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: DashboardRoute | typeof ACCOUNT_PATH;
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-20 items-center gap-3 rounded-2xl border bg-background p-4 transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-pretty text-muted-foreground">{body}</span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
