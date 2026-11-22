"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TypedConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** The label above the box, e.g. "Type DELETE". */
  typeLabel: string;
  /** Faint example inside the box, e.g. the word to type. */
  placeholder?: string;
  /** True when the typed text is the confirmation. The button stays disabled until then. */
  isConfirmed: (typed: string) => boolean;
  confirmLabel: string;
  cancelLabel: string;
  /** Text on the confirm button while the action runs. */
  busyLabel: string;
  /** True while the action runs: the box cannot be closed and both buttons wait. */
  busy: boolean;
  /** Red confirm button, for deleting. */
  destructive?: boolean;
  /** Called with the typed text once it is confirmed. */
  onConfirm: (typed: string) => void;
}

/**
 * "Type to confirm" box (Part E3 "ConfirmDialog — optional type to confirm",
 * Part C1.6): for the dangerous actions, the person must type a word or an
 * email before the confirm button works, so a stray tap never deletes anything.
 * The cursor starts in the box; Cancel comes first in the button order.
 */
export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  typeLabel,
  placeholder,
  isConfirmed,
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy,
  destructive = false,
  onConfirm,
}: TypedConfirmDialogProps) {
  const inputId = useId();
  const [typed, setTyped] = useState("");

  function changeOpen(next: boolean) {
    if (busy) return; // never close the box while the action runs
    onOpenChange(next);
    setTyped("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isConfirmed(typed) && !busy) onConfirm(typed);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg leading-snug">{title}</DialogTitle>
            <DialogDescription className="text-base">{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={inputId} className="text-base font-medium">
              {typeLabel}
            </Label>
            <input
              id={inputId}
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={placeholder}
              className={cn(
                "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
              )}
            />
          </div>

          {/* Cancel first (left on wide screens); on phones the buttons stack with the confirm button on top. */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 bg-background py-2 leading-tight whitespace-normal"
              onClick={() => changeOpen(false)}
              disabled={busy}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              className="h-auto min-h-12 py-2 leading-tight whitespace-normal"
              disabled={!isConfirmed(typed) || busy}
            >
              {busy ? busyLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
