"use client";

import Link from "next/link";
import { useActionState } from "react";

import { searchCustomerHistoryAction, type CustomerHistoryState } from "@/app/actions/dashboard/orders";
import { Field, StatCard, StatusPill } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

const initial: CustomerHistoryState = { status: "idle" };

/**
 * Operational phone/email history lookup (PRD §11).
 * Permission gated on the server and every search is audited.
 */
export function CustomerHistorySearch({ defaultQuery }: { defaultQuery?: string }) {
  const [state, formAction, pending] = useActionState(searchCustomerHistoryAction, initial);

  return (
    <div className="stack">
      <form action={formAction} className="card">
        <div className="card-header"><h2 className="card-title">Search order history</h2></div>
        <div className="card-body">
          <Field
            label="Phone number or email"
            htmlFor="query"
            required
            hint="Every search is recorded in the audit log with your name."
          >
            <input id="query" name="query" className="input" defaultValue={defaultQuery} required maxLength={120} placeholder="01712345678 or customer@example.com" />
          </Field>
        </div>
        <div className="card-footer">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {state.status === "error" ? (
        <div className="alert-danger" role="alert"><div>{state.message}</div></div>
      ) : null}

      {state.status === "success" ? (
        <>
          {state.result.riskNote ? (
            <div className="alert-warning">
              <div><strong>Risk signal:</strong> {state.result.riskNote}</div>
            </div>
          ) : null}

          <div className="grid-stats">
            <StatCard label="Total orders" value={state.result.totals.orders} />
            <StatCard label="Delivered" value={state.result.totals.delivered} />
            <StatCard label="Cancelled / rejected" value={state.result.totals.cancelled + state.result.totals.rejected} />
            <StatCard label="Lifetime value" value={formatMoney(state.result.totals.lifetimeValue)} hint="Delivered orders" />
          </div>

          <div className="grid-stats">
            <StatCard label="Returned / refunded" value={state.result.totals.returned} />
            <StatCard label="In fraud review" value={state.result.totals.fraudReview} />
          </div>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Orders for “{state.result.query}”</h2>
              <span className="muted-xs">{state.result.orders.length} shown</span>
            </div>

            {state.result.orders.length === 0 ? (
              <div className="card-body"><p className="muted">No orders found for that phone number or email.</p></div>
            ) : (
              <div className="table-wrap border-0">
                <table className="table">
                  <thead>
                    <tr><th>Order</th><th>Customer</th><th>District</th><th>Status</th><th className="text-right">Total</th><th /></tr>
                  </thead>
                  <tbody>
                    {state.result.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <span className="mono font-semibold">{order.orderNumber}</span>
                          <p className="muted-xs">{formatDateTime(order.placedAt)}</p>
                        </td>
                        <td className="text-sm">{order.customerName}</td>
                        <td className="text-xs">{order.districtName ?? "—"}</td>
                        <td>
                          <StatusPill status={order.status} />
                          <StatusPill status={order.paymentStatus} className="mt-1" />
                        </td>
                        <td className="td-num">{formatMoney(order.grandTotal)}</td>
                        <td className="td-actions">
                          <Link href={`/dashboard/orders/${order.id}`} className="btn-secondary btn-xs">Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
