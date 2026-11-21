"use client";

import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/**
 * False on the server and in the first browser render, then true. For things
 * that only the phone can know (its timezone, the real size of a chart): they
 * are drawn after the page has loaded, so the server and the phone never
 * disagree about the first HTML.
 */
export function useIsBrowser(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}
