import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MessageScreenProps {
  icon: LucideIcon;
  title: string;
  /** The friendly explanation. */
  children: ReactNode;
  /** The one thing the person can do next (Part E4 "Friendly message + one action"). */
  actions?: ReactNode;
  /** `warning` for things that are not the person's fault or choice (offline, paused). */
  tone?: "brand" | "warning";
}

/**
 * The shared layout of the "something is different" screens: offline, error,
 * account paused (Part E4: friendly message + one action). A round icon, a
 * short title, one or two sentences, then the buttons.
 */
export function MessageScreen({ icon: Icon, title, children, actions, tone = "brand" }: MessageScreenProps) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          tone === "brand" ? "bg-primary-soft text-primary" : "bg-warning/15 text-warning-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <div className="text-pretty text-muted-foreground">{children}</div>
      </div>
      {actions && <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">{actions}</div>}
    </main>
  );
}
