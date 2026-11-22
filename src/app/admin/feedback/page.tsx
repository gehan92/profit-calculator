import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader, Pager } from "@/components/admin/admin-ui";
import { FeedbackStatusControl } from "@/components/admin/feedback-status";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/lib/admin/admin-guard";
import { adminRoutes } from "@/lib/admin/admin-roles";
import { AdminRepository, type FeedbackRow } from "@/lib/admin/admin-repository";
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUSES, isFeedbackStatus, type FeedbackStatus } from "@/lib/admin/feedback-status";
import { formatAdminDateTime } from "@/lib/admin/format";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/admin/paging";
import { replyLink } from "@/lib/admin/reply-link";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Feedback" };

/**
 * /admin/feedback — the feedback inbox (Part D4 Feedback): status chips
 * (New / In progress / Done), the message, the page it was sent from, a reply
 * link (email or WhatsApp) and a link to the sender when they were logged in.
 * Support and Admin.
 */
export default function FeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  return (
    <Suspense fallback={<FeedbackSkeleton />}>
      <FeedbackContent searchParams={searchParams} />
    </Suspense>
  );
}

async function FeedbackContent({ searchParams }: Pick<PageProps<"/admin/feedback">, "searchParams">) {
  const { supabase } = await requireAdminPage("viewFeedback");
  const query = await searchParams;
  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const status = isFeedbackStatus(rawStatus) ? rawStatus : null;
  const page = parsePage(query.page);

  const repository = new AdminRepository(supabase);
  const [{ rows, total }, counts] = await Promise.all([
    repository.listFeedback({ status, page }),
    repository.feedbackCounts(),
  ]);

  const linkTo = (target: FeedbackStatus | null, targetPage = 1) => {
    const params = new URLSearchParams();
    if (target) params.set("status", target);
    if (targetPage > 1) params.set("page", String(targetPage));
    const text = params.toString();
    return text ? `${adminRoutes.feedback}?${text}` : adminRoutes.feedback;
  };
  const everything = counts.new + counts.in_progress + counts.done;

  return (
    <>
      <PageHeader title="Feedback" description="Messages and bug reports from visitors and shop owners." />

      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        <Chip href={linkTo(null)} active={status === null}>
          All ({everything})
        </Chip>
        {FEEDBACK_STATUSES.map((value) => (
          <Chip key={value} href={linkTo(value)} active={status === value}>
            {FEEDBACK_STATUS_LABELS[value]} ({counts[value]})
          </Chip>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState>{status ? `Nothing is marked “${FEEDBACK_STATUS_LABELS[status]}”.` : "No feedback yet."}</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((row) => (
              <FeedbackCard key={row.id} row={row} />
            ))}
          </ul>
          <Pager page={page} total={total} pageSize={ADMIN_PAGE_SIZE} hrefFor={(target) => linkTo(status, target)} />
        </>
      )}
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }) {
  const reply = replyLink(row.contact);

  return (
    <li className="rounded-2xl border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          <time dateTime={row.createdAt}>{formatAdminDateTime(row.createdAt)}</time>
          {row.page && <> · from <span className="font-medium text-foreground">{row.page}</span></>}
        </p>
        <FeedbackStatusControl id={row.id} status={row.status} />
      </div>

      {/* React escapes the text, so a message cannot add markup; line breaks are kept. */}
      <p className="mt-3 text-base break-words whitespace-pre-wrap">{row.message}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {row.contact ? (
          <span className="break-all">
            Contact: <span className="font-medium">{row.contact}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">No contact left</span>
        )}
        {reply && (
          <a href={reply.href} target={reply.kind === "whatsapp" ? "_blank" : undefined} rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
            {reply.label}
          </a>
        )}
        {row.userId ? (
          <Link href={`${adminRoutes.users}/${row.userId}`} className="font-medium text-primary underline-offset-4 hover:underline">
            View the sender
          </Link>
        ) : (
          <span className="text-muted-foreground">Sent by a guest</span>
        )}
      </div>
    </li>
  );
}

function FeedbackSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full max-w-md rounded-full" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
