import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { pageCount } from "@/lib/admin/paging";
import { cn } from "@/lib/utils";

/** Title of an admin screen with an optional line of help and buttons on the right. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

/** A white block with a heading, used for each section of a screen. */
export function Panel({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-background p-5", className)}>
      {(title || description) && (
        <div className="mb-4 space-y-1">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** One big number with its label (Part E3 "StatCard"). */
export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Makes the card a link, e.g. new feedback → the inbox. */
  href?: string;
}) {
  const body = (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const base = "rounded-2xl border bg-background p-5";

  return href ? (
    <Link href={href} className={cn(base, "transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}>
      <dl>{body}</dl>
    </Link>
  ) : (
    <dl className={base}>{body}</dl>
  );
}

const BADGE_TONES = {
  neutral: "bg-muted text-foreground",
  good: "bg-profit/15 text-profit-foreground",
  bad: "bg-loss/10 text-loss",
  warn: "bg-warning/15 text-warning-foreground",
  brand: "bg-primary-soft text-secondary-foreground",
} as const;

/** A small label such as "Blocked" or "Pro". The word always carries the meaning, colour only helps. */
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

/** A table that scrolls sideways on a phone (Part E3 "AdminTable"). */
export function AdminTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-background">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("bg-card px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-t px-4 py-3 align-top", className)} {...props} />;
}

/** A friendly line when a list is empty (Part E4: "Friendly line + one action"). */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/**
 * Previous / Next for a long list, as plain links (so it works without
 * JavaScript and the address keeps the page). `hrefFor(page)` builds the
 * address, keeping the search and filters.
 */
export function Pager({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = pageCount(total, pageSize);
  if (total <= pageSize && page === 1) {
    return <p className="mt-3 text-sm text-muted-foreground">{total === 1 ? "1 result" : `${total.toLocaleString("en-US")} results`}</p>;
  }

  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pages} · {total.toLocaleString("en-US")} results
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" className="bg-background">
            <Link href={hrefFor(page - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" disabled className="bg-background">Previous</Button>
        )}
        {page < pages ? (
          <Button asChild variant="outline" className="bg-background">
            <Link href={hrefFor(page + 1)}>Next</Link>
          </Button>
        ) : (
          <Button variant="outline" disabled className="bg-background">Next</Button>
        )}
      </div>
    </nav>
  );
}
