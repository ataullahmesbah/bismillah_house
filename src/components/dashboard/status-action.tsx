"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setUserStatusAction } from "@/app/actions/dashboard/people";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/api";

/**
 * Suspend, block or reactivate an account.
 *
 * When the shop requires a reason — moderators always do — the button opens a
 * short form rather than a browser confirm box, because a reason typed into a
 * `prompt()` cannot be reviewed, corrected or read back before sending. The
 * reason is stored on the account and repeated in the audit entry.
 *
 * The requirement is re-checked on the server; this only decides what to ask
 * for up front.
 */
export function StatusAction({
  userId,
  userName,
  nextStatus,
  label,
  className = "btn-danger-soft btn-xs",
  requireReason = false,
}: {
  userId: string;
  userName: string;
  nextStatus: "ACTIVE" | "SUSPENDED" | "BLOCKED";
  label: string;
  className?: string;
  /** Ask for a written reason before sending. */
  requireReason?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(withReason: string) {
    const formData = new FormData();
    formData.append("id", userId);
    formData.append("status", nextStatus);
    if (withReason) formData.append("reason", withReason);

    startTransition(async () => {
      const result = await setUserStatusAction(idleState, formData);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      setReason("");
      toast.success(result.status === "success" ? (result.message ?? "Updated.") : "Updated.");
      router.refresh();
    });
  }

  function start() {
    if (requireReason) {
      setOpen(true);
      return;
    }
    if (nextStatus !== "ACTIVE" && !window.confirm(`${label} ${userName}? They will be signed out immediately.`)) {
      return;
    }
    submit("");
  }

  if (!open) {
    return (
      <button type="button" className={className} onClick={start} disabled={pending}>
        {pending ? "…" : label}
      </button>
    );
  }

  return (
    <div className="panel mt-1 w-full max-w-sm space-y-2 text-left">
      <label className="label" htmlFor={`reason-${userId}`}>
        Why are you changing {userName}&apos;s status?
      </label>
      <textarea
        id={`reason-${userId}`}
        className="textarea"
        rows={2}
        maxLength={300}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="e.g. repeated fake orders, abusive messages"
      />
      <p className="form-hint">Recorded on the account and in the audit log.</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-danger btn-xs"
          onClick={() => submit(reason.trim())}
          disabled={pending || reason.trim().length < 5}
        >
          {pending ? "Saving…" : `Confirm ${label.toLowerCase()}`}
        </button>
        <button type="button" className="btn-ghost btn-xs" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
