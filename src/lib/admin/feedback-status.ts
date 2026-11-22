/**
 * The three states of a feedback message (Part F3 `feedback.status`, Part D4
 * "New / In progress / Done"). A small module with no dependencies, so both
 * server pages and the browser buttons can use it.
 */
export const FEEDBACK_STATUSES = ["new", "in_progress", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** The words shown for each status. */
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Done",
};

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}
