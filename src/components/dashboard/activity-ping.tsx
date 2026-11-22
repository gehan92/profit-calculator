"use client";

import { useEffect } from "react";
import { recordActivity } from "@/actions/account";
import { browserStore } from "@/lib/browser-store";

const PING_KEY = "activity:last-ping";
const PING_EVERY_MS = 60 * 60 * 1000;

/**
 * Tells the server this person is here (admin Users list: "last active"):
 * once when a dashboard screen opens, and again only after an hour. Renders
 * nothing. It lives in the dashboard layout, so it runs on every dashboard
 * screen (a Server Action is only available on pages that include it).
 */
export function ActivityPing() {
  useEffect(() => {
    const last = Number(browserStore.read(PING_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < PING_EVERY_MS) return;

    browserStore.write(PING_KEY, String(Date.now()));
    void recordActivity().catch(() => undefined);
  }, []);

  return null;
}
