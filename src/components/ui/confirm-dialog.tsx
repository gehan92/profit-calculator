"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Red confirm button, for deleting. */
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * "Are you sure?" box (Part E3 "ConfirmDialog"). The safe choice (cancel) gets
 * the cursor when the box opens, so a stray Enter never deletes anything.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // By default the dialog focuses its first button: choose the safe one instead.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug">{title}</DialogTitle>
          <DialogDescription className="text-base">{description}</DialogDescription>
        </DialogHeader>
        {/* Cancel first (left on wide screens); on phones the buttons stack with Confirm on top. */}
        <DialogFooter>
          <Button
            ref={cancelRef}
            variant="outline"
            className="h-auto min-h-12 bg-background py-2 leading-tight whitespace-normal"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className="h-auto min-h-12 py-2 leading-tight whitespace-normal"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
