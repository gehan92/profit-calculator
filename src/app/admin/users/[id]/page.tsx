import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/admin/admin-ui";
import { UserActions } from "@/components/admin/user-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/lib/admin/admin-guard";
import { canAdmin, adminRoutes } from "@/lib/admin/admin-roles";
import { AdminRepository } from "@/lib/admin/admin-repository";
import { auditActionLabel, auditSummary, auditWho } from "@/lib/admin/audit-format";
import { formatAdminDateTime, formatCount, tierLabel } from "@/lib/admin/format";
import { userLabel } from "@/lib/admin/mask";
import { refuseUserAction } from "@/lib/admin/user-rules";

export const metadata: Metadata = { title: "User" };

/**
 * /admin/users/[id] — one user (Part C2 "Admin — User detail", Part B4): the
 * facts an admin may see without permission (masked contact, joined, last
 * active, status, plan, counts), the support-access status, the action buttons
 * and the log of what was done to this user. The name, full contact details,
 * shop names and records are not shown.
 */
export default function UserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <UserDetailContent params={params} />
    </Suspense>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function UserDetailContent({ params }: Pick<PageProps<"/admin/users/[id]">, "params">) {
  const { id } = await params;
  const { supabase, user: actor, role } = await requireAdminPage("viewUsers");
  if (!UUID.test(id)) notFound();

  const repository = new AdminRepository(supabase);
  const user = await repository.userSummary(id);
  if (!user) notFound();

  const history = canAdmin(role, "viewAudit") ? await repository.listAudit({ targetUserId: id, pageSize: 20 }) : null;

  const refused = refuseUserAction(actor.id, { id: user.id, platformRole: user.platformRole }) !== null;
  const title = userLabel(user);

  return (
    <>
      <Link
        href={adminRoutes.users}
        className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        All users
      </Link>

      <PageHeader
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={user.status === "active" ? "good" : "bad"}>{user.status === "active" ? "Active" : "Blocked"}</Badge>
            {user.platformRole !== "user" && <Badge tone="warn">{user.platformRole === "admin" ? "Admin" : "Support"}</Badge>}
          </span>
        }
        actions={
          <UserActions
            user={{ id: user.id, hasEmail: user.emailMasked !== null, name: title, blocked: user.status === "blocked" }}
            canManage={canAdmin(role, "manageUsers") && !refused}
            canLoginHelp={canAdmin(role, "sendLoginHelp")}
          />
        }
      />

      <div className="space-y-4">
        <Panel title="Account">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Fact label="User ID" value={user.id} />
            <Fact label="Email" value={user.emailMasked ?? "—"} />
            <Fact label="Phone" value={user.phoneMasked ?? "—"} />
            <Fact label="Joined" value={formatAdminDateTime(user.createdAt)} />
            <Fact label="Last active" value={formatAdminDateTime(user.lastActiveAt)} />
            <Fact label="Plan" value={tierLabel(user.tier)} />
            <Fact
              label="Support access"
              value={
                user.supportAccessOn
                  ? `ON until ${formatAdminDateTime(user.supportAccessUntil)}`
                  : "OFF — the profile stays hidden"
              }
            />
          </dl>
        </Panel>

        <Panel title="Counts" description="Numbers only. A shop's name and records are private to the shop.">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            <Fact label="Shops owned" value={formatCount(user.shopsCount)} />
            <Fact label="Shops joined as Staff or Viewer" value={formatCount(user.membershipsCount)} />
            <Fact label="Entries in their shops" value={formatCount(user.entriesCount)} />
          </dl>
        </Panel>

        {history && (
          <Panel title="Activity log for this user" description="What admins did to this account (latest 20).">
            {history.rows.length === 0 ? (
              <EmptyState>Nothing yet.</EmptyState>
            ) : (
              <ul className="divide-y text-sm">
                {history.rows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                    <span>
                      <span className="font-medium">{auditActionLabel(row.action)}</span>
                      <span className="text-muted-foreground"> by {auditWho(row)}</span>
                      {auditSummary(row) && <span className="text-muted-foreground"> · {auditSummary(row)}</span>}
                    </span>
                    <time dateTime={row.createdAt} className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatAdminDateTime(row.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-all">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
