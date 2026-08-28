"use client";

import { useActionState, useState } from "react";

import { cancelOrderAction } from "@/app/actions/account";
import { idleState } from "@/lib/api";

/** Customer-side cancellation, only offered while the order is still early. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(cancelOrderAction, idleState);
  const [open, setOpen] = useState(false);

  if (state.status === "success") {
    return <p className="text-sm font-semibold text-success-600">{state.message}</p>;
  }

  if (!open) {
    return (
      <button type="button" className="btn-danger-soft btn-sm" onClick={() => setOpen(true)}>
        Cancel this order
      </button>
    );
  }

  return (
    <form action={formAction} className="panel stack">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="label" htmlFor="cancel-reason">Why are you cancelling?</label>
      <textarea id="cancel-reason" name="reason" className="textarea" rows={2} maxLength={300} required />
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="btn-danger btn-sm" disabled={pending}>
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Keep my order</button>
      </div>
    </form>
  );
}
