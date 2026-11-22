"use client";

import { ChevronDownIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { isAppLocale, LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  /**
   * On phones, show one small "EN ▾" menu instead of the three-part switch, to
   * leave room in the top bar for "Log in" and "Create free account" (Part C1.7:
   * both stay visible on phones). From the `sm` width up the full switch shows.
   */
  compactOnMobile?: boolean;
}

/**
 * EN / සිං / த switch shown on every page (Part F4.3).
 *
 * Built from real links, not buttons: it works before JavaScript loads,
 * search engines can follow it, and switching keeps the user on the same page.
 * next-intl stores the choice in a cookie so the next visit opens in it.
 */
export function LanguageSwitcher({ className, compactOnMobile = false }: LanguageSwitcherProps) {
  const t = useTranslations("language");
  const currentLocale = useLocale();
  const pathname = usePathname();

  const switcher = (
    <nav
      aria-label={t("label")}
      className={cn(
        "inline-flex items-center rounded-full border bg-card p-1",
        compactOnMobile && "hidden sm:inline-flex",
        className,
      )}
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
              "flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-medium transition-colors",
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

  if (!compactOnMobile) return switcher;

  return (
    <>
      <CompactMenu label={t("label")} currentLocale={currentLocale} pathname={pathname} className={className} />
      {switcher}
    </>
  );
}

/**
 * The phone version: a native <details> menu, so it also opens before
 * JavaScript loads. It closes when you tap outside, press Escape or pick a language.
 */
function CompactMenu({
  label,
  currentLocale,
  pathname,
  className,
}: {
  label: string;
  currentLocale: string;
  pathname: string;
  className?: string;
}) {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutside(event: Event) {
      const element = menu.current;
      if (element && event.target instanceof Node && !element.contains(event.target)) element.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current) menu.current.open = false;
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const current = isAppLocale(currentLocale) ? LOCALE_LABELS[currentLocale] : LOCALE_LABELS.en;

  return (
    <details ref={menu} className={cn("relative sm:hidden", className)}>
      <summary
        aria-label={label}
        className={cn(
          "flex h-10 cursor-pointer list-none items-center gap-1 rounded-full border bg-card pr-2 pl-3 text-sm font-medium select-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <span aria-hidden="true">{current.short}</span>
        <span className="sr-only">{current.full}</span>
        <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      </summary>
      <ul className="absolute top-full left-0 z-50 mt-2 min-w-40 rounded-xl border bg-popover p-1 shadow-lg">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              lang={locale}
              hrefLang={locale}
              aria-current={locale === currentLocale ? "true" : undefined}
              onClick={() => {
                if (menu.current) menu.current.open = false;
              }}
              className={cn(
                "flex min-h-11 items-center rounded-lg px-3 text-base transition-colors",
                locale === currentLocale ? "bg-accent font-semibold text-accent-foreground" : "hover:bg-muted",
              )}
            >
              {LOCALE_LABELS[locale].full}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
