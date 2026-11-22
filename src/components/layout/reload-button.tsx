"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** "Try again" for the offline screen: loads the page again. */
export function ReloadButton({ children }: { children: ReactNode }) {
  return (
    <Button type="button" size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal w-full sm:w-auto sm:px-8" onClick={() => window.location.reload()}>
      {children}
    </Button>
  );
}
