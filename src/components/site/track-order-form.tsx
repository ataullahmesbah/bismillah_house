"use client";

import Link from "next/link";
import { useActionState } from "react";

import { trackOrderAction, type TrackOrderState } from "@/app/actions/public";
import { Field, StatusPill } from "@/components/ui";
import { usePreservedForm } from "@/lib/hooks/use-preserved-form";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanizeEnum } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

const initial: TrackOrderState = { status: "idle" };

export function TrackOrderForm({ defaultReference }: { defaultReference?: string }) {
  const [state, formAction, pending] = useActionState(trackOrderAction, initial);
  // TrackOrderState mirrors ActionState closely enough for the preserve hook.
  const { formProps } = usePreservedForm(state.status === "error" ? { status: "error", message: state.message } : { status: "idle" });
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <div className="stack">
      <form {...formProps} action={formAction} className="card">
        <div className="card-header"><h2 className="card-title">Find your order</h2></div>
        <div className="card-body grid-form-2">
          <Field label="Order number" htmlFor="reference" required error={fields.reference} hint="For example TM-260821-4839.">
            <input id="reference" name="reference" className="input uppercase" defaultValue={defaultReference} required maxLength={80} />
          </Field>
          <Field label="Mobile number on the order" htmlFor="phone" required error={fields.phone}>
            <input id="phone" name="phone" className="input" required inputMode="tel" placeholder="01XXXXXXXXX" maxLength={20} />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              {pending ? "Searching…" : "Track order"}
            </button>
          </div>
        </div>
      </form>

      {state.status === "error" ? (
        <div className="alert-danger" role="alert"><div>{state.message}</div></div>
      ) : null}

      {state.status === "success" ? (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Order {state.order.orderNumber}</h2>
              <p className="muted-xs">Placed {formatDateTime(state.order.placedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill status={state.order.status} />
              <StatusPill status={state.order.paymentStatus} />
            </div>
          </div>

          <div className="card-body stack">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel">
                <p className="stat-label">Delivery district</p>
                <p className="mt-1 text-sm font-semibold">{state.order.districtName ?? "—"}</p>
                {state.order.estimatedDays ? (
                  <p className="muted-xs">Usually {state.order.estimatedDays} days</p>
                ) : null}
              </div>
              <div className="panel">
                <p className="stat-label">Payment</p>
                <p className="mt-1 text-sm font-semibold">{humanizeEnum(state.order.paymentMethod)}</p>
                <p className="muted-xs">{formatMoney(state.order.grandTotal)}</p>
              </div>
              <div className="panel">
                <p className="stat-label">Courier</p>
                <p className="mt-1 text-sm font-semibold">{state.order.shipment?.courierName ?? "Not dispatched yet"}</p>
                {state.order.shipment?.trackingNumber ? (
                  <p className="muted-xs mono">{state.order.shipment.trackingNumber}</p>
                ) : null}
                {state.order.shipment?.currentLocation ? (
                  <p className="muted-xs">Last seen at {state.order.shipment.currentLocation}</p>
                ) : null}
                {state.order.shipment?.trackingUrl ? (
                  <a href={state.order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-link mt-1 text-xs">
                    Open courier tracking →
                  </a>
                ) : null}
              </div>
            </div>

            {state.order.shipment && state.order.shipment.steps.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-bold">Parcel journey</h3>
                <ol className="timeline">
                  {state.order.shipment.steps.map((step, index) => (
                    <li key={index} className="timeline-item">
                      <span className="timeline-dot" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{humanizeEnum(step.status)}</p>
                        {step.description ? <p className="muted-xs">{step.description}</p> : null}
                        <p className="muted-xs">
                          {formatDateTime(step.at)}
                          {step.location ? ` · ${step.location}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-bold">Delivery timeline</h3>
              <ol className="timeline">
                {state.order.timeline.map((event, index) => (
                  <li key={index} className="timeline-item">
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {ORDER_STATUS_LABELS[event.status as keyof typeof ORDER_STATUS_LABELS] ?? humanizeEnum(event.status)}
                      </p>
                      <p className="muted-xs">{formatDateTime(event.at)}</p>
                      {event.note ? <p className="mt-0.5 text-xs text-brand-600">{event.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold">Items</h3>
              <ul className="space-y-1.5">
                {state.order.items.map((item, index) => (
                  <li key={index} className="flex justify-between gap-3 text-sm">
                    <span>
                      {item.name}
                      {item.variantName ? <span className="text-brand-500"> — {item.variantName}</span> : null}
                      <span className="text-brand-500"> × {item.quantity}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(item.total)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={`/api/orders/${state.order.publicToken}/invoice`} className="btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">
                Download invoice
              </a>
              <Link href="/contact" className="btn-ghost btn-sm">Need help with this order?</Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
