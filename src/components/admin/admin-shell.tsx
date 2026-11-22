import { LogOutIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutForm } from "@/components/auth/logout-form";
import { ADMIN_NAV, canAdmin, isTeamRole } from "@/lib/admin/admin-roles";
import { getPlatformContext } from "@/lib/admin/admin-guard";
import { dashboardPath } from "@/lib/auth/routes";
import { AdminNav } from "./admin-nav";

/**
 * The frame around every admin screen (Part C2 "Admin — Dashboard (laptop)"):
 * a slate sidebar on laptops (so the admin never looks like the shop app),
 * a menu bar on phones, and a link back to the admin's own shop.
 *
 * It is also the layout guard (Part F2 `admin/layout.tsx`): anyone who is not
 * Support or Admin gets a 404. The proxy has already answered 404 first; this
 * is the second lock.
 */
export async function AdminShell({ children }: { children: ReactNode }) {
  const context = await getPlatformContext();
  if (!context || !isTeamRole(context.role)) notFound();

  const items = ADMIN_NAV.filter((item) => canAdmin(context.role, item.permission));
  const roleLabel = context.role === "admin" ? "Admin" : "Support";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0">
        <div className="flex h-full flex-col gap-4 px-4 py-4 lg:px-0 lg:py-5">
          <div className="flex items-center justify-between gap-3 lg:px-6">
            <p className="font-semibold tracking-tight">
              Profit Calculator <span className="font-normal text-sidebar-foreground/70">Admin</span>
            </p>
            <span className="rounded-full bg-sidebar-accent px-2.5 py-0.5 text-xs font-medium lg:hidden">{roleLabel}</span>
          </div>

          <AdminNav items={items} variant="sidebar" />

          <div className="mt-auto hidden space-y-3 border-t border-sidebar-border px-6 pt-4 lg:block">
            <AccountBlock email={context.user.email} roleLabel={roleLabel} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        {/* On phones the account block sits under the page. */}
        <div className="border-t bg-background px-4 py-4 lg:hidden">
          <AccountBlock email={context.user.email} roleLabel={roleLabel} onLight />
        </div>
      </div>
    </div>
  );
}

function AccountBlock({ email, roleLabel, onLight = false }: { email: string | null; roleLabel: string; onLight?: boolean }) {
  const muted = onLight ? "text-muted-foreground" : "text-sidebar-foreground/70";
  const link = onLight
    ? "text-foreground hover:bg-muted"
    : "text-sidebar-foreground hover:bg-sidebar-accent/60";

  return (
    <>
      <p className="text-sm">
        <span className={`block text-xs ${muted}`}>Logged in as {roleLabel}</span>
        <span className="block font-medium break-all">{email ?? "—"}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
        <Link
          href={dashboardPath()}
          className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium ${link}`}
        >
          <StoreIcon aria-hidden="true" className="size-4" />
          My shop
        </Link>
        {/* A real form, so logging out works without JavaScript. */}
        <LogoutForm locale="en">
          <button
            type="submit"
            className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium ${link}`}
          >
            <LogOutIcon aria-hidden="true" className="size-4" />
            Log out
          </button>
        </LogoutForm>
      </div>
    </>
  );
}
