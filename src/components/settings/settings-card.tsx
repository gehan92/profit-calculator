import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  /** Unique on the page; names the section for screen readers. */
  id: string;
  title: string;
  description?: string;
  /** Red outline for the dangerous section (delete account). */
  danger?: boolean;
  children: ReactNode;
}

/** One block of the Settings screen: a heading, a short explanation and its controls. */
export function SettingsCard({ id, title, description, danger = false, children }: SettingsCardProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "space-y-4 rounded-2xl border bg-background p-5 sm:p-6",
        danger && "border-destructive/40",
      )}
    >
      <div className="space-y-1">
        <h2 id={`${id}-title`} className={cn("text-lg font-semibold", danger && "text-destructive")}>
          {title}
        </h2>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
