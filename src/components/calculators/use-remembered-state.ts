"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { z } from "zod";
import { browserStore } from "@/lib/browser-store";

type Update<T> = T | ((previous: T) => T);

/**
 * Like `useState`, but the value is remembered in this browser
 * ("last values remembered in the browser", Part D1 shared rules).
 *
 * - The server and the first browser render use `initial`, so there is no
 *   hydration mismatch; the saved value appears right after.
 * - Saved data is checked with the zod `schema`. Old or broken data is ignored.
 * - `initial` and `schema` must be constants defined outside the component.
 *
 * Returns `[value, setValue, reset]`. `reset` forgets the saved value.
 */
export function useRememberedState<T>(
  storageKey: string,
  schema: z.ZodType<T>,
  initial: T,
): [T, (update: Update<T>) => void, () => void] {
  const raw = useSyncExternalStore(
    browserStore.subscribe,
    () => browserStore.read(storageKey),
    () => null,
  );

  const value = useMemo(() => decode(raw, schema) ?? initial, [raw, schema, initial]);

  const setValue = useCallback(
    (update: Update<T>) => {
      const current = decode(browserStore.read(storageKey), schema) ?? initial;
      const next = typeof update === "function" ? (update as (previous: T) => T)(current) : update;
      browserStore.write(storageKey, JSON.stringify(next));
    },
    [storageKey, schema, initial],
  );

  const reset = useCallback(() => browserStore.write(storageKey, null), [storageKey]);

  return [value, setValue, reset];
}

function decode<T>(raw: string | null, schema: z.ZodType<T>): T | null {
  if (raw === null) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
