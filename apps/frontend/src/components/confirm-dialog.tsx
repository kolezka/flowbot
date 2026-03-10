"use client";

import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const descriptionId = "confirm-dialog-description";

  return (
    <DialogContent open={open} onClose={() => onOpenChange(false)} aria-describedby={descriptionId}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription id={descriptionId}>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} autoFocus>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          disabled={loading}
        >
          {loading ? "Processing..." : confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
