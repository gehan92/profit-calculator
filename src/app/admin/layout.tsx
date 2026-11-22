import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

/**
 * Root layout of the admin panel (Part F2: "admin/ — English only, outside
 * [locale]"). It has its own <html>, so none of the translated site's
 * machinery (language switch, analytics) is loaded here. Never indexed by
 * search engines.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh bg-card">
        {/* Reads the login cookie, so it streams in behind a boundary (Cache Components). */}
        <Suspense fallback={<AdminLoading />}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}

function AdminLoading() {
  return (
    <div className="flex min-h-dvh" aria-hidden="true">
      <div className="hidden w-60 shrink-0 bg-sidebar lg:block" />
      <div className="flex-1 space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
