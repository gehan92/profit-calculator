"use client";

import { useLocale, useTranslations } from "next-intl";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * EN / සිං / த switch shown on every page (Part F4.3).
 *
 * Built from real links, not buttons: it works before JavaScript loads,
 * search engines can follow it, and switching keeps the user on the same page.
 * next-intl stores the choice in a cookie so the next visit opens in it.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const currentLocale = useLocale();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className={cn("inline-flex items-center rounded-full border bg-card p-1", className)}
    >
      {LOCALES.map((locale) => {
        const isActive = locale === currentLocale;
        const label = LOCALE_LABELS[locale];

        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            lang={locale}
            hrefLang={locale}
            title={label.full}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex h-8 min-w-10 items-center justify-center rounded-full px-2.5 text-sm font-medium transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span aria-hidden="true">{label.short}</span>
            <span className="sr-only">{label.full}</span>
          </Link>
        );
      })}
    </nav>
  );
}
