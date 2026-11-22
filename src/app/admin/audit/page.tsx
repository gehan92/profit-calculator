import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminTable, EmptyState, PageHeader, Pager, Td, Th } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/lib/admin/admin-guard";
import { adminRoutes } from "@/lib/admin/admin-roles";
import { AdminRepository } from "@/lib/admin/admin-repository";
import { AUDIT_ACTION_LABELS, auditActionLabel, auditSummary, auditTarget, auditWho, isAuditAction } from "@/lib/admin/audit-format";
import { AUDIT_ACTIONS } from "@/lib/admin/audit-log";
import { formatAdminDateTime } from "@/lib/admin/format";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/admin/paging";

export const metadata: Metadata = { title: "Audit log" };

/**
 * /admin/audit — everything admins and support did (Part D4 Audit log, Part
 * B3): time, who, action, who it was about and what changed. Admin only; the
 * rows are written by the server with the secret key, never by this page.
 */
export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<AuditSkeleton />}>
      <AuditContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AuditContent({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const { supabase } = await requireAdminPage("viewAudit");
  const query = await searchParams;
  const rawAction = Array.isArray(query.action) ? query.action[0] : query.action;
  const action = isAuditAction(rawAction) ? rawAction : null;
  const page = parsePage(query.page);

  const { rows, total } = await new AdminRepository(supabase).listAudit({ action, page });
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (target > 1) params.set("page", String(target));
    const text = params.toString();
    return text ? `${adminRoutes.audit}?${text}` : adminRoutes.audit;
  };

  return (
    <>
      <PageHeader title="Audit log" description="Every action by an admin or support person. Newest first. Times are Sri Lanka time." />

      <form action={adminRoutes.audit} method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="audit-action" className="text-sm font-medium">
          Action
        </label>
        <select
          id="audit-action"
          name="action"
          defaultValue={action ?? ""}
          className="h-11 rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((value) => (
            <option key={value} value={value}>
              {AUDIT_ACTION_LABELS[value]}
            </option>
          ))}
        </select>
        <Button type="submit" className="h-11 px-6">
          Filter
        </Button>
        {action && (
          <Button asChild variant="ghost" className="h-11">
            <Link href={adminRoutes.audit}>Clear</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState>{action ? "No actions of this kind yet." : "Nothing has been logged yet."}</EmptyState>
      ) : (
        <>
          <AdminTable caption="Audit log">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>About</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const target = auditTarget(row);
                return (
                  <tr key={row.id}>
                    <Td className="whitespace-nowrap">
                      <time dateTime={row.createdAt}>{formatAdminDateTime(row.createdAt)}</time>
                    </Td>
                    <Td className="break-all">{auditWho(row)}</Td>
                    <Td className="font-medium">{auditActionLabel(row.action)}</Td>
                    <Td className="break-all">
                      {target && row.targetUserId && row.action !== "user.delete" ? (
                        <Link href={`${adminRoutes.users}/${row.targetUserId}`} className="text-primary underline-offset-4 hover:underline">
                          {target}
                        </Link>
                      ) : (
                        (target ?? "—")
                      )}
                    </Td>
                    <Td className="font-mono text-xs break-all text-muted-foreground">{auditSummary(row) || "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
          <Pager page={page} total={total} pageSize={ADMIN_PAGE_SIZE} hrefFor={hrefFor} />
        </>
      )}
    </>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-72 rounded-xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
