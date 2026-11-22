import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DailyCountChart } from "@/components/admin/daily-count-chart";
import { PageHeader, Panel, StatCard } from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { adminLanding, adminRoutes } from "@/lib/admin/admin-roles";
import { AdminRepository, type AdminStats } from "@/lib/admin/admin-repository";
import { getPlatformContext, requireAdminPage } from "@/lib/admin/admin-guard";
import { formatCount } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * /admin — the dashboard (Part D4, Part C2 "Admin — Dashboard"): totals from
 * `admin_stats()`, never one shop's money. Support is sent on to the Users list.
 *
 * Visitors, calculator use, shares, top pages and countries come from the
 * website analytics, which is not connected to this panel yet.
 */
export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const context = await getPlatformContext();
  if (context?.role === "support") redirect(adminLanding("support"));

  const { supabase } = await requireAdminPage("viewStats");
  const repository = new AdminRepository(supabase);
  const [stats, daily] = await Promise.all([repository.stats(), repository.dailyStats(30)]);

  return (
    <>
      <PageHeader title="Dashboard" description="Totals for the whole website. Nothing here shows what any shop earns." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={formatCount(stats.usersTotal)} hint={`${formatCount(stats.blockedUsers)} blocked`} href={adminRoutes.users} />
        <StatCard label="Sign-ups today" value={formatCount(stats.signupsToday)} hint={`${formatCount(stats.signups7d)} in 7 days · ${formatCount(stats.signups30d)} in 30 days`} />
        <StatCard label="Active this week" value={formatCount(stats.weeklyActive)} hint="People who added an entry in 7 days" />
        <StatCard label="Entries today" value={formatCount(stats.entriesToday)} />
        <StatCard label="Shops" value={formatCount(stats.businessesTotal)} hint={`${formatCount(stats.proBusinesses)} on Pro`} />
        <StatCard label="New feedback" value={formatCount(stats.feedbackNew)} hint="Waiting for a reply" href={`${adminRoutes.feedback}?status=new`} />
        <div className="col-span-2">
          <LanguageSplit split={stats.languageSplit} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Sign-ups per day" description="Last 30 days">
          <DailyCountChart
            data={daily.map((day) => ({ date: day.date, value: day.signups }))}
            unit="sign-ups"
            ariaLabel="Bar chart of new sign-ups for each of the last 30 days."
          />
        </Panel>
        <Panel title="Active people per day" description="People who added at least one entry that day">
          <DailyCountChart
            data={daily.map((day) => ({ date: day.date, value: day.activeUsers }))}
            unit="active people"
            ariaLabel="Bar chart of the people who added an entry on each of the last 30 days."
          />
        </Panel>
      </div>
    </>
  );
}

const LANGUAGE_NAMES: Record<string, string> = { en: "English", si: "Sinhala", ta: "Tamil" };

/** Shops per language as one bar split in parts, with the numbers written out. */
function LanguageSplit({ split }: { split: AdminStats["languageSplit"] }) {
  const entries = Object.entries(split).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="h-full rounded-2xl border bg-background p-5">
      <p className="text-sm text-muted-foreground">Shops by language</p>
      {total === 0 ? (
        <p className="mt-2 text-sm">No shops yet.</p>
      ) : (
        <>
          <div aria-hidden="true" className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            {entries.map(([locale, count], index) => (
              <div
                key={locale}
                className="h-full border-r-2 border-background last:border-r-0"
                style={{ width: `${(count / total) * 100}%`, background: SPLIT_SHADES[index % SPLIT_SHADES.length] }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {entries.map(([locale, count], index) => (
              <li key={locale} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SPLIT_SHADES[index % SPLIT_SHADES.length] }} />
                {LANGUAGE_NAMES[locale] ?? locale} {formatCount(count)} ({Math.round((count / total) * 100)}%)
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Dark to light steps of the brand teal; the words and numbers beside them carry the meaning. */
const SPLIT_SHADES = ["#0f766e", "#14b8a6", "#99f6e4"];

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
