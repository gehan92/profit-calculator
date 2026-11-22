import { AUDIT_ACTIONS, type AuditAction } from "./audit-log";
import type { AuditRow } from "./admin-repository";

/** Plain words for each action, for the audit log page and its filter. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "user.block": "Blocked a user",
  "user.unblock": "Unblocked a user",
  "user.delete": "Deleted a user",
  "user.login_help": "Sent login help",
  "feedback.status": "Changed a feedback status",
  "settings.update": "Changed a setting",
};

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function auditActionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Who did it: their email as it was then, otherwise a shortened id, otherwise "deleted account". */
export function auditWho(row: Pick<AuditRow, "actorId" | "details">): string {
  return text(row.details.actor_email) ?? (row.actorId ? `${row.actorId.slice(0, 8)}…` : "deleted account");
}

/** Who it was about: the email or name saved with the row, otherwise a shortened id; `null` when there is no target. */
export function auditTarget(row: Pick<AuditRow, "targetUserId" | "details">): string | null {
  const named = text(row.details.email) ?? text(row.details.name);
  if (named) return named;
  return row.targetUserId ? `${row.targetUserId.slice(0, 8)}…` : null;
}

function show(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) return "?";
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}

/** One line about what changed. Never a shop's money: the details hold settings, statuses and emails only. */
export function auditSummary(row: Pick<AuditRow, "action" | "details">): string {
  const { details } = row;
  switch (row.action) {
    case "settings.update":
      return `${text(details.key) ?? "setting"}: ${show(details.from)} → ${show(details.to)}`;
    case "feedback.status":
      return `status → ${text(details.status) ?? "?"}`;
    default:
      return "";
  }
}
