import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminTable, Badge, EmptyState, PageHeader, Pager, Td, Th } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/lib/admin/admin-guard";
import { adminRoutes } from "@/lib/admin/admin-roles";
import { AdminRepository, type AdminUserRow } from "@/lib/admin/admin-repository";
import { formatAdminDate, formatCount, tierLabel } from "@/lib/admin/format";
import { userLabel } from "@/lib/admin/mask";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/admin/paging";

export const metadata: Metadata = { title: "Users" };

const SEARCH_MAX_LENGTH = 100;

/**
 * /admin/users — find and list users (Part D4 Users, Part B4): masked contact,
 * joined, last active, plan, counts, status. Support and Admin. To find one
 * person, type their exact email, phone or user ID; the full profile needs the
 * user's own permission. The search text and the page are in the address.
 */
export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersContent({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const { supabase } = await requireAdminPage("viewUsers");
  const query = await searchParams;
  const rawSearch = Array.isArray(query.q) ? query.q[0] : query.q;
  const search = (rawSearch ?? "").trim().slice(0, SEARCH_MAX_LENGTH);
  const page = parsePage(query.page);

  const { users, total } = await new AdminRepository(supabase).listUsers({ search, page });
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (target > 1) params.set("page", String(target));
    const text = params.toString();
    return text ? `${adminRoutes.users}?${text}` : adminRoutes.users;
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Contact details are hidden (k***@gmail.com). To find one person, type their exact email, phone or user ID. A shop's records are never shown here."
      />

      <form action={adminRoutes.users} method="get" role="search" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="user-search" className="sr-only">
          Find by exact email, phone or user ID
        </label>
        <input
          id="user-search"
          name="q"
          type="search"
          defaultValue={search}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Exact email, phone or user ID"
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:max-w-md"
        />
        <Button type="submit" className="h-11 px-6">
          Search
        </Button>
        {search && (
          <Button asChild variant="ghost" className="h-11">
            <Link href={adminRoutes.users}>Clear</Link>
          </Button>
        )}
      </form>

      {users.length === 0 ? (
        <EmptyState>{search ? `No user has exactly “${search}” as email, phone or user ID.` : "No users yet."}</EmptyState>
      ) : (
        <>
          <AdminTable caption="Users">
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Joined</Th>
                <Th>Last active</Th>
                <Th>Plan</Th>
                <Th className="text-right">Shops</Th>
                <Th className="text-right">Entries</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </tbody>
          </AdminTable>
          <Pager page={page} total={total} pageSize={ADMIN_PAGE_SIZE} hrefFor={hrefFor} />
        </>
      )}
    </>
  );
}

function UserRow({ user }: { user: AdminUserRow }) {
  return (
    <tr>
      <Td>
        <Link
          href={`${adminRoutes.users}/${user.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {userLabel(user)}
        </Link>
        <span className="mt-0.5 block text-xs break-all text-muted-foreground">
          {[user.phoneMasked, `ID ${user.id.slice(0, 8)}`].filter(Boolean).join(" · ")}
        </span>
      </Td>
      <Td className="whitespace-nowrap">{formatAdminDate(user.createdAt)}</Td>
      <Td className="whitespace-nowrap">{formatAdminDate(user.lastActiveAt)}</Td>
      <Td>
        <Badge tone={user.tier === "free" ? "neutral" : "brand"}>{tierLabel(user.tier)}</Badge>
      </Td>
      <Td className="text-right tabular-nums">{formatCount(user.shopsCount)}</Td>
      <Td className="text-right tabular-nums">{formatCount(user.entriesCount)}</Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          <Badge tone={user.status === "active" ? "good" : "bad"}>{user.status === "active" ? "Active" : "Blocked"}</Badge>
          {user.platformRole !== "user" && <Badge tone="warn">{user.platformRole === "admin" ? "Admin" : "Support"}</Badge>}
        </div>
      </Td>
    </tr>
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full max-w-md rounded-xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
