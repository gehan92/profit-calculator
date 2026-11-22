"use client";

import {
  LayoutDashboardIcon,
  MessageSquareIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminRoutes } from "@/lib/admin/admin-roles";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  [adminRoutes.dashboard]: LayoutDashboardIcon,
  [adminRoutes.users]: UsersIcon,
  [adminRoutes.feedback]: MessageSquareIcon,
  [adminRoutes.audit]: ScrollTextIcon,
  [adminRoutes.settings]: SettingsIcon,
};

interface AdminNavProps {
  items: readonly { href: string; label: string }[];
  /** "sidebar": a column on laptops. "bar": a row you can scroll sideways on phones. */
  variant: "sidebar" | "bar";
}

/** Is `href` the page being shown? The dashboard only for exactly /admin; the others also for pages below them. */
function isActive(pathname: string, href: string): boolean {
  return href === adminRoutes.dashboard ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** The admin menu (Part C1 "Navigation by role": Dashboard · Users · Feedback · Audit log · Settings). */
export function AdminNav({ items, variant }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className={variant === "sidebar" ? "px-3" : "-mx-4 overflow-x-auto px-4"}>
      <ul className={cn(variant === "sidebar" ? "space-y-1" : "flex gap-1")}>
        {items.map((item) => {
          const Icon = ICONS[item.href] ?? LayoutDashboardIcon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
