import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { IsoDate } from "@/lib/dates";
import type { PlatformRole } from "@/lib/roles";
import type { Database } from "@/lib/supabase/types";
import { parseSettings, type AppSettings, type SettingKey } from "./app-settings";
import { FEEDBACK_STATUSES, isFeedbackStatus, type FeedbackStatus } from "./feedback-status";
import { ADMIN_PAGE_SIZE, pageRange } from "./paging";

/** Thrown when Supabase refuses or fails an admin query. */
export class AdminQueryError extends Error {
  constructor(action: string, cause: { message: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "AdminQueryError";
  }
}

// ----------------------------------------------------------------------- types

/** Dashboard totals (Part D4): counts only, never one shop's money. */
export interface AdminStats {
  usersTotal: number;
  signupsToday: number;
  signups7d: number;
  signups30d: number;
  weeklyActive: number;
  entriesToday: number;
  businessesTotal: number;
  proBusinesses: number;
  blockedUsers: number;
  feedbackNew: number;
  /** Shops per language, e.g. { en: 12, si: 30 }. */
  languageSplit: Record<string, number>;
}

export interface DailyStat {
  date: IsoDate;
  signups: number;
  /** People who added at least one entry that day. */
  activeUsers: number;
}

/**
 * One user in the list (Part B4): contact details are MASKED (k***@gmail.com)
 * and there is no name; the full details need the user's permission.
 */
export interface AdminUserRow {
  id: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  platformRole: PlatformRole;
  status: string;
  /** "free", "pro" or "business" right now. */
  tier: string;
  shopsCount: number;
  /** Entries in the user's own shops: a count, never amounts. */
  entriesCount: number;
}

export interface AdminUserPage {
  users: AdminUserRow[];
  total: number;
}

/** One user's page: the same masked facts plus the support-access status and counts. */
export interface AdminUserSummary extends AdminUserRow {
  supportAccessUntil: string | null;
  /** True while the user's "allow support to view my account" switch is on. */
  supportAccessOn: boolean;
  /** Shops they belong to as Staff or Viewer (not owner). */
  membershipsCount: number;
}

export interface FeedbackRow {
  id: string;
  userId: string | null;
  message: string;
  contact: string | null;
  page: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

export interface AuditRow {
  id: number;
  actorId: string | null;
  action: string;
  targetUserId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

// --------------------------------------------------------- what the database returns

const statsSchema = z.object({
  users_total: z.number(),
  signups_today: z.number(),
  signups_7d: z.number(),
  signups_30d: z.number(),
  weekly_active: z.number(),
  entries_today: z.number(),
  businesses_total: z.number(),
  pro_businesses: z.number(),
  blocked_users: z.number(),
  feedback_new: z.number(),
  language_split: z.record(z.string(), z.number()),
});

const summarySchema = z.object({
  id: z.string(),
  email_masked: z.string().nullable(),
  phone_masked: z.string().nullable(),
  created_at: z.string(),
  last_active_at: z.string().nullable(),
  platform_role: z.enum(["user", "support", "admin"]),
  status: z.string(),
  tier: z.string(),
  support_access_until: z.string().nullable(),
  support_access_on: z.boolean(),
  shops_count: z.number(),
  memberships_count: z.number(),
  entries_count: z.number(),
});

// ------------------------------------------------------------------- repository

/**
 * Reads and writes what the admin panel shows (Part D4). Uses the logged-in
 * person's own Supabase client, so the database itself checks the role: the
 * `admin_*` functions raise "forbidden" for anyone but Support/Admin, and RLS
 * limits feedback, the audit log and settings the same way. Admin and Support
 * never get a shop's money records through any of this.
 */
export class AdminRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Dashboard totals. Admin only. */
  async stats(): Promise<AdminStats> {
    const { data, error } = await this.db.rpc("admin_stats");
    if (error) throw new AdminQueryError("load the totals", error);

    const stats = statsSchema.parse(data);
    return {
      usersTotal: stats.users_total,
      signupsToday: stats.signups_today,
      signups7d: stats.signups_7d,
      signups30d: stats.signups_30d,
      weeklyActive: stats.weekly_active,
      entriesToday: stats.entries_today,
      businessesTotal: stats.businesses_total,
      proBusinesses: stats.pro_businesses,
      blockedUsers: stats.blocked_users,
      feedbackNew: stats.feedback_new,
      languageSplit: stats.language_split,
    };
  }

  /** Sign-ups and active people for each of the last `days` days, oldest first. Admin only. */
  async dailyStats(days = 30): Promise<DailyStat[]> {
    const { data, error } = await this.db.rpc("admin_daily_stats", { p_days: days });
    if (error) throw new AdminQueryError("load the daily totals", error);
    return data.map((row) => ({ date: row.day, signups: row.signups, activeUsers: row.active_users }));
  }

  /**
   * One page of users, newest first. With no search text it lists the newest
   * users; with text it finds the ONE user whose email, phone or user ID is
   * exactly that text (Part B4: no guessing from part of a name).
   */
  async listUsers(options: { search?: string; page?: number; pageSize?: number } = {}): Promise<AdminUserPage> {
    const { search = "", page = 1, pageSize = ADMIN_PAGE_SIZE } = options;
    const { data, error } = await this.db.rpc("admin_find_users", {
      p_query: search,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });
    if (error) throw new AdminQueryError("load the users", error);

    return {
      users: data.map((row) => ({
        id: row.user_id,
        emailMasked: row.email_masked ?? null,
        phoneMasked: row.phone_masked ?? null,
        createdAt: row.created_at,
        lastActiveAt: row.last_active_at ?? null,
        platformRole: row.platform_role,
        status: row.status,
        tier: row.tier,
        shopsCount: Number(row.shops_count),
        entriesCount: Number(row.entries_count),
      })),
      total: data.length > 0 ? Number(data[0].total_count) : 0,
    };
  }

  /** One user's masked facts and counts, or `null` when there is no such user. */
  async userSummary(userId: string): Promise<AdminUserSummary | null> {
    const { data, error } = await this.db.rpc("admin_user_summary", { p_user_id: userId });
    if (error) throw new AdminQueryError("load the user", error);
    if (data === null) return null;

    const summary = summarySchema.parse(data);
    return {
      id: summary.id,
      emailMasked: summary.email_masked,
      phoneMasked: summary.phone_masked,
      createdAt: summary.created_at,
      lastActiveAt: summary.last_active_at,
      platformRole: summary.platform_role,
      status: summary.status,
      tier: summary.tier,
      supportAccessUntil: summary.support_access_until,
      supportAccessOn: summary.support_access_on,
      shopsCount: summary.shops_count,
      membershipsCount: summary.memberships_count,
      entriesCount: summary.entries_count,
    };
  }

  /** One page of feedback, newest first, optionally only one status. Support and Admin. */
  async listFeedback(
    options: { status?: FeedbackStatus | null; page?: number; pageSize?: number } = {},
  ): Promise<{ rows: FeedbackRow[]; total: number }> {
    const { status = null, page = 1, pageSize = ADMIN_PAGE_SIZE } = options;
    const { from, to } = pageRange(page, pageSize);

    let query = this.db
      .from("feedback")
      .select("id, user_id, message, contact, page, status, created_at", { count: "exact" });
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new AdminQueryError("load the feedback", error);

    return {
      rows: data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        message: row.message,
        contact: row.contact,
        page: row.page,
        status: isFeedbackStatus(row.status) ? row.status : "new",
        createdAt: row.created_at,
      })),
      total: count ?? 0,
    };
  }

  /** Counts per status for the filter chips. */
  async feedbackCounts(): Promise<Record<FeedbackStatus, number>> {
    const counts: Record<FeedbackStatus, number> = { new: 0, in_progress: 0, done: 0 };
    await Promise.all(
      FEEDBACK_STATUSES.map(async (status) => {
        const { count, error } = await this.db
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        if (error) throw new AdminQueryError("count the feedback", error);
        counts[status] = count ?? 0;
      }),
    );
    return counts;
  }

  /** Changes a feedback status. Returns `false` when nothing changed (not found, or not allowed). */
  async updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<boolean> {
    const { data, error } = await this.db.from("feedback").update({ status }).eq("id", id).select("id");
    if (error) throw new AdminQueryError("change the feedback status", error);
    return data.length > 0;
  }

  /** One page of the audit log, newest first, optionally one action. Admin only. */
  async listAudit(
    options: { action?: string | null; targetUserId?: string | null; page?: number; pageSize?: number } = {},
  ): Promise<{ rows: AuditRow[]; total: number }> {
    const { action = null, targetUserId = null, page = 1, pageSize = ADMIN_PAGE_SIZE } = options;
    const { from, to } = pageRange(page, pageSize);

    let query = this.db
      .from("audit_log")
      .select("id, actor_id, action, target_user_id, details, created_at", { count: "exact" });
    if (action) query = query.eq("action", action);
    if (targetUserId) query = query.eq("target_user_id", targetUserId);

    const { data, error, count } = await query.order("id", { ascending: false }).range(from, to);
    if (error) throw new AdminQueryError("load the audit log", error);

    return {
      rows: data.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        targetUserId: row.target_user_id,
        details:
          row.details && typeof row.details === "object" && !Array.isArray(row.details)
            ? (row.details as Record<string, unknown>)
            : {},
        createdAt: row.created_at,
      })),
      total: count ?? 0,
    };
  }

  /** Every setting, with the default used for anything missing. */
  async settings(): Promise<AppSettings> {
    const { data, error } = await this.db.from("app_settings").select("key, value");
    if (error) throw new AdminQueryError("load the settings", error);
    return parseSettings(data);
  }

  /** Saves one setting. The database allows this for Admins only (RLS). */
  async saveSetting(key: SettingKey, value: unknown, adminId: string): Promise<void> {
    const { data, error } = await this.db
      .from("app_settings")
      .upsert(
        { key, value: value as never, updated_by: adminId, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      )
      .select("key");

    if (error) throw new AdminQueryError("save the setting", error);
    if (data.length === 0) throw new AdminQueryError("save the setting", { message: "not allowed" });
  }
}
