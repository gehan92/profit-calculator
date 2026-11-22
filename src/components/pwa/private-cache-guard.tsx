"use client";

import { useEffect } from "react";
import { clearPrivateCaches } from "@/lib/pwa/private-cache";
import { hasAuthCookie } from "@/lib/supabase/config";

/** The names of the cookies this page can see, without their values. */
function visibleCookieNames(): { name: string }[] {
  return document.cookie
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

/**
 * A second safety net for the saved dashboard pages (Part F4.4): whenever a page
 * opens and nobody is logged in, the saved dashboard copies on this phone are
 * deleted. Logging out already does it, but a page request that was still on
 * its way at that moment could be saved just afterwards; an expired login or a
 * log out in another tab would also leave copies behind.
 */
export function PrivateCacheGuard() {
  useEffect(() => {
    if (!hasAuthCookie(visibleCookieNames())) void clearPrivateCaches();
  }, []);

  return null;
}
