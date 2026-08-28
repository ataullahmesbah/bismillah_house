"use client";

import { useActionState, useState } from "react";

import {
  addOrderNoteAction, createRefundAction, flagOrderAction,
  updateOrderStatusAction, updatePaymentAction,
} from "@/app/actions/dashboard/orders";
import { FormFeedback, SubmitButton } from "./action-form";
import { Field } from "@/components/ui";
import { idleState } from "@/lib/api";
import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatMoney, fromMinor } from "@/lib/money";
import type { OrderStatus } from "@/generated/prisma/enums";

/** Status transitions are limited to what the state machine allows. */
export function OrderStatusPanel({
  orderId,
  currentStatus,
  allowedStatuses,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  allowedStatuses: OrderStatus[];
}) {
  const [state, formAction, pending] = useActionState(updateOrderStatusAction, idleState);
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">Update status</h2></div>
      <div className="card-body stack">
        <FormFeedback state={state} />
        <input type="hidden" name="orderId" value={orderId} />

        {allowedStatuses.length === 0 ? (
          <p className="muted">
            This order is {ORDER_STATUS_LABELS[currentStatus].toLowerCase()} — no further transitions are allowed.
          </p>
        ) : (
          <>
            <Field label="New status" htmlFor="status" required>
              <select id="status" name="status" className="select" defaultValue={allowedStatuses[0]}>
                {allowedStatuses.map((status) => (
                  <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>
                ))}
              </select>
            </Field>
            <Field label="Note for the timeline" htmlFor="note" hint="Visible to the customer in their tracking history.">
              <input id="note" name="note" className="input" maxLength={500} />
            </Field>
          </>
        )}
      </div>
      {allowedStatuses.length > 0 ? (
        <div className="card-footer">
          <SubmitButton pending={pending}>Apply status change</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

export function InternalNotePanel({ orderId, notes }: { orderId: string; notes: string | null }) {
  const [state, formAction, pending] = useActionState(addOrderNoteAction, idleState);
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className="card">
      <div className="card-header">
        <h2 className="card-title">Internal notes</h2>
        <span className="badge-gray">Staff only</span>
      </div>
      <div className="card-body stack">
        <FormFeedback state={state} />
        <input type="hidden" name="orderId" value={orderId} />

        {notes ? (
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-tm)] bg-surface-muted p-3 text-xs leading-relaxed text-brand-700">
            {notes}
          </pre>
        ) : (
          <p className="muted">No internal notes yet.</p>
        )}

        <Field label="Add a note" htmlFor="note" required>
          <textarea id="note" name="note" className="textarea min-h-20" required maxLength={2000} />
        </Field>
      </div>
      <div className="card-footer">
        <SubmitButton pending={pending} className="btn-secondary">Add note</SubmitButton>
      </div>
    </form>
  );
}

export function PaymentPanel({
  orderId,
  paymentStatus,
  grandTotal,
  paidTotal,
  refundedTotal,
  canRefund,
  attempts = [],
}: {
  orderId: string;
  paymentStatus: string;
  grandTotal: number;
  paidTotal: number;
  refundedTotal: number;
  canRefund: boolean;
  /** What the customer said they paid, for reconciliation against a statement. */
  attempts?: Array<{
    id: string;
    provider: string;
    transactionId: string | null;
    senderNumber: string | null;
  }>;
}) {
  const [payState, payAction, payPending] = useActionState(updatePaymentAction, idleState);
  const [refundState, refundAction, refundPending] = useActionState(createRefundAction, idleState);
  const [showRefund, setShowRefund] = useState(false);
  useRefreshOnSuccess(payState);
  useRefreshOnSuccess(refundState);

  const refundable = grandTotal - refundedTotal;

  return (
    <div className="card">
      <div className="card-header"><h2 className="card-title">Payment</h2></div>

      <div className="card-body stack">
        <dl className="space-y-1 text-sm">
          <div className="summary-row"><dt>Order total</dt><dd className="font-semibold">{formatMoney(grandTotal)}</dd></div>
          <div className="summary-row"><dt>Recorded as paid</dt><dd>{formatMoney(paidTotal)}</dd></div>
          {refundedTotal > 0 ? (
            <div className="summary-row text-warning-700"><dt>Refunded</dt><dd>−{formatMoney(refundedTotal)}</dd></div>
          ) : null}
        </dl>

        {/* Customer-declared details — verify against the wallet statement
            before marking the order paid. */}
        {attempts.some((attempt) => attempt.transactionId || attempt.senderNumber) ? (
          <div className="panel stack text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
              Customer-declared payment
            </p>
            {attempts.map((attempt) =>
              attempt.transactionId || attempt.senderNumber ? (
                <dl key={attempt.id} className="space-y-1">
                  {attempt.senderNumber ? (
                    <div className="summary-row">
                      <dt>Paid from</dt>
                      <dd className="mono">{attempt.senderNumber}</dd>
                    </div>
                  ) : null}
                  {attempt.transactionId ? (
                    <div className="summary-row">
                      <dt>Transaction ID</dt>
                      <dd className="mono">{attempt.transactionId}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null,
            )}
          </div>
        ) : null}

        <form action={payAction} className="stack">
          <FormFeedback state={payState} />
          <input type="hidden" name="orderId" value={orderId} />
          <Field label="Payment status" htmlFor="paymentStatus">
            <select id="paymentStatus" name="paymentStatus" className="select" defaultValue={paymentStatus}>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <div className="grid-form-2">
            <Field label="Amount received (৳)" htmlFor="paidAmount">
              <input id="paidAmount" name="paidAmount" type="number" step="0.01" min="0" className="input" defaultValue={paidTotal ? fromMinor(paidTotal) : ""} />
            </Field>
            <Field label="Transaction ID" htmlFor="transactionId">
              <input id="transactionId" name="transactionId" className="input" maxLength={80} />
            </Field>
          </div>
          <SubmitButton pending={payPending} className="btn-secondary self-start">Update payment</SubmitButton>
        </form>

        {canRefund && refundable > 0 ? (
          showRefund ? (
            <form action={refundAction} className="panel stack">
              <FormFeedback state={refundState} />
              <input type="hidden" name="orderId" value={orderId} />
              <Field label={`Refund amount (৳) — up to ${formatMoney(refundable)}`} htmlFor="amount" required>
                <input id="amount" name="amount" type="number" step="0.01" min="0" max={fromMinor(refundable)} className="input" required />
              </Field>
              <Field label="Reason" htmlFor="reason" required>
                <input id="reason" name="reason" className="input" required maxLength={400} />
              </Field>
              <div className="flex gap-2">
                <SubmitButton pending={refundPending} className="btn-danger btn-sm">Record refund</SubmitButton>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowRefund(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn-danger-soft btn-sm self-start" onClick={() => setShowRefund(true)}>
              Record a refund
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

export function FraudFlagPanel({
  orderId,
  isFlagged,
  flagReason,
}: {
  orderId: string;
  isFlagged: boolean;
  flagReason: string | null;
}) {
  const [state, formAction, pending] = useActionState(flagOrderAction, idleState);
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className={isFlagged ? "card border-danger-500" : "card"}>
      <div className="card-header">
        <h2 className="card-title">Fraud review</h2>
        {isFlagged ? <span className="badge-red">Flagged</span> : null}
      </div>
      <div className="card-body stack">
        <FormFeedback state={state} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="flagged" value={isFlagged ? "false" : "true"} />

        {isFlagged ? (
          <p className="text-sm text-brand-700">Reason on file: {flagReason ?? "not recorded"}</p>
        ) : (
          <Field label="Reason" htmlFor="reason" hint="Recorded in the audit log.">
            <input id="reason" name="reason" className="input" maxLength={300} placeholder="Repeat rejections, suspicious address…" />
          </Field>
        )}
      </div>
      <div className="card-footer">
        <SubmitButton pending={pending} className={isFlagged ? "btn-secondary" : "btn-danger-soft"}>
          {isFlagged ? "Clear flag" : "Flag for review"}
        </SubmitButton>
      </div>
    </form>
  );
}
