"use client";

import {
  BarChart3Icon,
  CalendarCheckIcon,
  HomeIcon,
  ListChecksIcon,
  ListIcon,
  PlusCircleIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { dashboardRoutes, NAV, type DashboardRoute, type MemberRole, type NavKey } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ICONS: Record<NavKey, LucideIcon> = {
  home: HomeIcon,
  add: PlusCircleIcon,
  summary: BarChart3Icon,
  settings: SettingsIcon,
  today: CalendarCheckIcon,
  myEntries: ListChecksIcon,
  entries: ListIcon,
};

/**
 * Screens that exist so far. The others show "Soon" instead of a link that
 * would open "page not found"; each one is added here on its day in the
 * plan (summary + settings: Day 10).
 */
const READY = new Set<DashboardRoute>([
  dashboardRoutes.home,
  dashboardRoutes.add,
  dashboardRoutes.entries,
  dashboardRoutes.summary,
  dashboardRoutes.settings,
]);

interface DashboardNavProps {
  role: MemberRole;
  /** "tabs": fixed bar at the bottom of phones. "sidebar": column on laptops. */
  variant: "tabs" | "sidebar";
}

/**
 * Phone bottom tabs / laptop sidebar (Part C1, Part E3 "BottomTabBar /
 * Sidebar"). The items come from the role, so each role sees only its own
 * screens.
 */
export function DashboardNav({ role, variant }: DashboardNavProps) {
  const t = useTranslations("appNav");
  const pathname = usePathname();
  const items = NAV[role];

  if (variant === "tabs") {
    return (
      <nav
        aria-label={t("label")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(({ href, key }) => {
            const Icon = ICONS[key];
            const active = pathname === href;
            const content = (
              <>
                <Icon aria-hidden="true" className="size-6" />
                <span className="max-w-full truncate">{t(key)}</span>
              </>
            );
            // Smaller text on the narrowest phones (320 px): a long Tamil word such as
            // "அமைப்புகள்" must fit in a quarter of the screen without being cut.
            const itemClass =
              "flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium min-[360px]:text-xs";

            return (
              <li key={href}>
                {READY.has(href) ? (
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      itemClass,
                      "transition-colors focus-visible:bg-muted focus-visible:outline-none",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title={t("soon")}
                    className={cn(itemClass, "cursor-not-allowed text-muted-foreground/50")}
                  >
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={t("label")} className="hidden w-56 shrink-0 py-8 lg:block">
      <ul className="sticky top-24 space-y-1">
        {items.map(({ href, key }) => {
          const Icon = ICONS[key];
          const active = pathname === href;
          const itemClass = "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 font-medium";

          return (
            <li key={href}>
              {READY.has(href) ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    itemClass,
                    "transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {t(key)}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={cn(itemClass, "cursor-not-allowed text-muted-foreground/60")}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {t(key)}
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">{t("soon")}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
