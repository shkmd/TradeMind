"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ConfirmDeleteState = { status: "idle" | "error" | "success"; message?: string };

const initialState: ConfirmDeleteState = { status: "idle" };

export function ConfirmDeleteButton({
  action,
  hiddenFields,
  triggerLabel,
  title,
  description,
  confirmLabel = "Delete",
}: {
  action: (prevState: ConfirmDeleteState, formData: FormData) => Promise<ConfirmDeleteState>;
  hiddenFields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {state.status === "error" && state.message && (
            <p className="mb-3 text-sm font-medium text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
