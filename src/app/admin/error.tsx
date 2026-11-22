"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** An admin screen broke while being drawn: say so plainly and offer one action (English only, like the whole panel). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning-foreground">
        <TriangleAlertIcon aria-hidden="true" className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">This screen could not be shown. Nothing was changed. Please try again.</p>
      <Button type="button" size="lg" className="px-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
