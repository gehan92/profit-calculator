"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { ACCOUNT_TABS, accountTabHref, type AccountTab } from "@/lib/account/tabs";
import { cn } from "@/lib/utils";

/**
 * The six sections of the Account page (spec D6) as a row of links: each one is
 * a real address (`?tab=privacy`), so the browser's Back button, bookmarks and
 * screen readers all work. On a phone the row scrolls sideways inside its own
 * box, and the open section is scrolled into view so it is never hidden off
 * to the right.
 */
export function AccountTabs({ active }: { active: AccountTab }) {
  const t = useTranslations("accountPage");
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const box = nav.current;
    const link = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !link) return;

    // Centre the open section inside the strip (the page itself must not move).
    const offset = link.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
    box.scrollLeft = offset - (box.clientWidth - link.offsetWidth) / 2;
  }, [active]);

  return (
    <nav ref={nav} aria-label={t("tabsLabel")} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-1 rounded-xl bg-muted p-1 sm:w-full">
        {ACCOUNT_TABS.map((tab) => {
          const selected = tab === active;
          return (
            <li key={tab} className="sm:flex-1">
              <Link
                href={accountTabHref(tab)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-lg px-3 text-center text-sm leading-tight font-medium whitespace-nowrap transition-colors sm:whitespace-normal",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`tabs.${tab}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
