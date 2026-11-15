"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/** Sends the `signup` event once after the first login (Part F4.6). Renders nothing. */
export function SignupTracker({ method }: { method: "google" | "email" }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("signup", { method });
  }, [method]);

  return null;
}
