"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { voidTransactionAction } from "@/app/actions/dashboard/finance";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/api";

/**
 * Voids a posted transaction.
 *
 * A written reason is required rather than a confirm box, because a voided
 * entry with no explanation is the same as a deleted one for anyone reading
 * the books later.
 */
export function VoidTransaction({ id, description }: { id: string; description: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit() {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("reason", reason.trim());

    startTransition(async () => {
      const result = await voidTransactionAction(idleState, formData);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      setReason("");
      toast.success(result.status === "success" ? (result.message ?? "Voided.") : "Voided.");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn-danger-soft btn-xs" onClick={() => setOpen(true)} disabled={pending}>
        Void
      </button>
    );
  }

  return (
    <div className="panel mt-1 w-full max-w-sm space-y-2 text-left">
      <label className="label" htmlFor={`void-${id}`}>Why is this being voided?</label>
      <textarea
        id={`void-${id}`}
        className="textarea"
        rows={2}
        maxLength={300}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="e.g. entered twice by mistake"
      />
      <p className="form-hint">
        The entry stays in the books, marked as voided. Reports skip it; the history keeps it.
      </p>
      <p className="muted-xs clamp-2">{description}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-danger btn-xs"
          onClick={submit}
          disabled={pending || reason.trim().length < 5}
        >
          {pending ? "Voiding…" : "Confirm void"}
        </button>
        <button type="button" className="btn-ghost btn-xs" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
