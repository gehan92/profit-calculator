import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_REMINDER_TIME,
  isDateFormat,
  type DateFormat,
  type NotificationSettings,
  type RegionSettings,
} from "./profile";

/** Everything the Account page shows about the logged-in person. */
export interface AccountProfile {
  fullName: string | null;
  avatarUrl: string | null;
  /** The language the person saved; `null` until they choose one. */
  locale: string | null;
  dateFormat: DateFormat;
  /** Pre-selected when making a shop; `null` = ask each time. */
  defaultCurrency: string | null;
  notifications: NotificationSettings;
  supportAccessUntil: string | null;
}

/** One signed-in device (`my_sessions()`): when it signed in, when it was last used, what it said it was. */
export interface SignedInDevice {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  /** True for the device that is asking. */
  current: boolean;
}

const ACCOUNT_COLUMNS =
  "full_name, avatar_url, locale, date_format, default_currency, notify_daily, notify_daily_time, notify_weekly, notify_payments, support_access_until" as const;

/** Thrown when Supabase refuses or fails a profile query. */
export class ProfileQueryError extends Error {
  constructor(action: string, cause: { message: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "ProfileQueryError";
  }
}

/**
 * Reads and writes the logged-in person's own profile (Part F3 `profiles`).
 * Like the other repositories it uses the person's own Supabase client:
 * Row Level Security lets them read their profile and change only their name
 * and support access (the database grants no other column to users, so they
 * can never make themselves an admin).
 */
export class ProfileRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * Whether an Admin has paused this account (`blocked`, Part D4 "Block").
   * A missing profile counts as active: the database refuses a blocked or
   * profile-less person's writes anyway (`is_active()`), so this only decides
   * which screen to show.
   */
  async isBlocked(userId: string): Promise<boolean> {
    const { data, error } = await this.db.from("profiles").select("status").eq("id", userId).maybeSingle();

    if (error) throw new ProfileQueryError("check the account status", error);
    return data?.status === "blocked";
  }

  /** The time support access ends, or `null` when it was never switched on / was switched off. */
  async getSupportAccessUntil(userId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select("support_access_until")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new ProfileQueryError("load the profile", error);
    return data?.support_access_until ?? null;
  }

  /** Switches support access on (an end time) or off (`null`). */
  async setSupportAccessUntil(userId: string, until: Date | null): Promise<void> {
    const { data, error } = await this.db
      .from("profiles")
      .update({ support_access_until: until ? until.toISOString() : null })
      .eq("id", userId)
      .select("id");

    if (error) throw new ProfileQueryError("change support access", error);
    // RLS hides rows instead of failing, so "0 rows changed" means "no such profile".
    if (data.length === 0) throw new ProfileQueryError("change support access", { message: "no profile" });
  }

  /** The person's own settings, for the Account page. A missing profile gets the defaults. */
  async getAccountProfile(userId: string): Promise<AccountProfile> {
    const { data, error } = await this.db.from("profiles").select(ACCOUNT_COLUMNS).eq("id", userId).maybeSingle();
    if (error) throw new ProfileQueryError("load the profile", error);

    return {
      fullName: data?.full_name ?? null,
      avatarUrl: data?.avatar_url ?? null,
      locale: data?.locale ?? null,
      dateFormat: isDateFormat(data?.date_format) ? data.date_format : DEFAULT_DATE_FORMAT,
      defaultCurrency: data?.default_currency ?? null,
      notifications: {
        daily: data?.notify_daily ?? false,
        // The database sends "07:30:00"; the screen works with "07:30".
        dailyTime: (data?.notify_daily_time ?? DEFAULT_REMINDER_TIME).slice(0, 5),
        weekly: data?.notify_weekly ?? false,
        payments: data?.notify_payments ?? true,
      },
      supportAccessUntil: data?.support_access_until ?? null,
    };
  }

  /** Saves the name (`null` removes it). */
  async setName(userId: string, name: string | null): Promise<void> {
    await this.change("save the name", userId, { full_name: name });
  }

  /** Saves the address of the profile photo (`null` removes the photo). */
  async setAvatarUrl(userId: string, url: string | null): Promise<void> {
    await this.change("save the photo", userId, { avatar_url: url });
  }

  /** Saves language, date format and the default currency for new shops. */
  async setRegion(userId: string, region: RegionSettings): Promise<void> {
    await this.change("save the language and region", userId, {
      locale: region.locale,
      date_format: region.dateFormat,
      default_currency: region.defaultCurrency,
    });
  }

  /** Saves the reminder and email choices. */
  async setNotifications(userId: string, settings: NotificationSettings): Promise<void> {
    await this.change("save the notification choices", userId, {
      notify_daily: settings.daily,
      notify_daily_time: settings.dailyTime,
      notify_weekly: settings.weekly,
      notify_payments: settings.payments,
    });
  }

  /** The person's own signed-in devices, most recently used first. */
  async listDevices(): Promise<SignedInDevice[]> {
    const { data, error } = await this.db.rpc("my_sessions");
    if (error) throw new ProfileQueryError("load the signed-in devices", error);

    return data.map((row) => ({
      id: row.session_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      userAgent: row.user_agent,
      current: row.is_current,
    }));
  }

  /** When our team looked at this account (times only), newest first. */
  async listAccessLog(): Promise<string[]> {
    const { data, error } = await this.db.rpc("my_access_log");
    if (error) throw new ProfileQueryError("load the access log", error);
    return data.map((row) => row.viewed_at);
  }

  private async change(
    action: string,
    userId: string,
    values: Database["public"]["Tables"]["profiles"]["Update"],
  ): Promise<void> {
    const { data, error } = await this.db.from("profiles").update(values).eq("id", userId).select("id");
    if (error) throw new ProfileQueryError(action, error);
    // RLS hides rows instead of failing, so "0 rows changed" means "no such profile".
    if (data.length === 0) throw new ProfileQueryError(action, { message: "no profile" });
  }
}
