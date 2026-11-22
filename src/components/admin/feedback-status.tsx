"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { setFeedbackStatus } from "@/actions/admin/feedback";
import { FEEDBACK_STATUSES, FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/lib/admin/feedback-status";
import { cn } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  notAllowed: "You are not allowed to do this.",
  notFound: "This message no longer exists.",
};

/**
 * New / In progress / Done for one message (Part D4 Feedback). A row of
 * real radio buttons, so the keyboard and screen readers work; the change is
 * saved at once and written to the audit log.
 */
export function FeedbackStatusControl({ id, status }: { id: string; status: FeedbackStatus }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);

  async function change(next: FeedbackStatus) {
    if (next === current || busy) return;
    const previous = current;
    setCurrent(next);
    setBusy(true);
    try {
      const result = await setFeedbackStatus(id, next);
      if (!result.ok) {
        setCurrent(previous);
        toast.error(ERRORS[result.error] ?? "It did not work. Please try again.");
        return;
      }
      if (!result.auditSaved) toast.warning("Saved, but the audit log row could not be saved.");
      router.refresh();
    } catch {
      setCurrent(previous);
      toast.error("It did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset disabled={busy} className="min-w-0">
      <legend className="sr-only">Status</legend>
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {FEEDBACK_STATUSES.map((value) => (
          <label
            key={value}
            className={cn(
              "flex min-h-9 cursor-pointer items-center justify-center rounded-lg px-3 text-center text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors",
              "hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            )}
          >
            <input
              type="radio"
              name={`feedback-status-${id}`}
              value={value}
              checked={current === value}
              onChange={() => void change(value)}
              className="sr-only"
            />
            {FEEDBACK_STATUS_LABELS[value]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
