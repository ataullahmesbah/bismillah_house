"use client";

import { useActionState, useState } from "react";

import { FormFeedback, SubmitButton } from "@/components/dashboard/action-form";
import { Field, StatusPill } from "@/components/ui";
import {
  addTrackingStepAction,
  dispatchOrderAction,
  recordManualShipmentAction,
  recordSettlementAction,
  syncShipmentAction,
} from "@/app/actions/dashboard/courier";
import { MANUAL_SHIPMENT_STATUSES } from "@/lib/validation/courier";
import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";
import { idleState } from "@/lib/api";
import { formatMoney, fromMinor } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export type CourierOption = { id: string; name: string; provider: string; hasApi: boolean };

export type ShipmentView = {
  id: string;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  consignmentId: string | null;
  status: string;
  currentLocation: string | null;
  deliveryManName: string | null;
  deliveryManPhone: string | null;
  estimatedDeliveryAt: Date | null;
  pickupAt: Date | null;
  deliveredAt: Date | null;
  courierCharge: number;
  collectedAmount: number;
  settledAmount: number;
  settlementStatus: string;
  lastSyncedAt: Date | null;
  syncError: string | null;
  events: Array<{ id: string; status: string; description: string | null; location: string | null; occurredAt: Date; source: string }>;
};

/**
 * Everything courier-related for one order, in one panel.
 *
 * Before a parcel exists it offers two routes — create it through the API, or
 * record a tracking number typed in the courier's own dashboard. Both have to
 * be here: the API route is the point of the feature, and the manual route is
 * what keeps parcels moving on the day the API is down.
 */
export function CourierPanel({
  orderId,
  couriers,
  shipment,
  canDispatch,
  canSettle,
  orderTotal,
  outstanding,
}: {
  orderId: string;
  couriers: CourierOption[];
  shipment: ShipmentView | null;
  canDispatch: boolean;
  canSettle: boolean;
  orderTotal: number;
  /** What the courier should collect on delivery, in minor units. */
  outstanding: number;
}) {
  if (shipment) {
    return (
      <ActiveShipment
        shipment={shipment}
        canDispatch={canDispatch}
        canSettle={canSettle}
        orderTotal={orderTotal}
      />
    );
  }
  if (!canDispatch) return null;
  return <DispatchForm orderId={orderId} couriers={couriers} outstanding={outstanding} />;
}

function DispatchForm({
  orderId,
  couriers,
  outstanding,
}: {
  orderId: string;
  couriers: CourierOption[];
  outstanding: number;
}) {
  const [mode, setMode] = useState<"api" | "manual">(couriers.some((c) => c.hasApi) ? "api" : "manual");
  const [dispatchState, dispatchAction, dispatching] = useActionState(dispatchOrderAction, idleState);
  const [manualState, manualAction, savingManual] = useActionState(recordManualShipmentAction, idleState);
  useRefreshOnSuccess(dispatchState);
  useRefreshOnSuccess(manualState);

  const apiCouriers = couriers.filter((courier) => courier.hasApi);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Send to courier</h2>
        <div className="tabs border-0">
          <button
            type="button"
            className={mode === "api" ? "tab tab-active" : "tab"}
            onClick={() => setMode("api")}
            disabled={apiCouriers.length === 0}
          >
            Automatic
          </button>
          <button type="button" className={mode === "manual" ? "tab tab-active" : "tab"} onClick={() => setMode("manual")}>
            Enter tracking
          </button>
        </div>
      </div>

      {mode === "api" ? (
        <form action={dispatchAction}>
          <div className="card-body stack">
            <FormFeedback state={dispatchState} />
            <input type="hidden" name="orderId" value={orderId} />

            {apiCouriers.length === 0 ? (
              <p className="muted">
                No courier has API credentials configured yet. Add them to your environment, or use
                <strong> Enter tracking</strong> to record a parcel you created in the courier&apos;s dashboard.
              </p>
            ) : (
              <>
                <Field label="Courier" htmlFor="dispatch-courier">
                  <select id="dispatch-courier" name="courierId" className="select" required>
                    {apiCouriers.map((courier) => (
                      <option key={courier.id} value={courier.id}>{courier.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Instruction for the rider" htmlFor="dispatch-note">
                  <input id="dispatch-note" name="note" className="input" maxLength={200} placeholder="e.g. call before arriving" />
                </Field>
                <p className="muted-xs">
                  The courier will collect <strong>{formatMoney(outstanding)}</strong> on delivery.
                  The parcel is created in their system — nobody needs to open their dashboard.
                </p>
              </>
            )}
          </div>
          {apiCouriers.length > 0 ? (
            <div className="card-footer">
              <SubmitButton pending={dispatching}>Create parcel</SubmitButton>
            </div>
          ) : null}
        </form>
      ) : (
        <form action={manualAction}>
          <div className="card-body stack">
            <FormFeedback state={manualState} />
            <input type="hidden" name="orderId" value={orderId} />

            <div className="grid-form-2">
              <Field label="Courier" htmlFor="manual-courier">
                <select id="manual-courier" name="courierId" className="select">
                  <option value="">Other</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>{courier.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Courier name" htmlFor="manual-courier-name" hint="Only if you picked Other.">
                <input id="manual-courier-name" name="courierName" className="input" maxLength={80} />
              </Field>
              <Field label="Tracking number" htmlFor="manual-tracking">
                <input id="manual-tracking" name="trackingNumber" className="input" required maxLength={80} />
              </Field>
              <Field label="Courier charge" htmlFor="manual-charge">
                <input id="manual-charge" name="courierCharge" type="number" step="0.01" min="0" className="input" placeholder="0.00" />
              </Field>
            </div>
            <Field label="Note" htmlFor="manual-note">
              <input id="manual-note" name="note" className="input" maxLength={300} />
            </Field>
          </div>
          <div className="card-footer">
            <SubmitButton pending={savingManual} className="btn-secondary">Save tracking</SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}

function ActiveShipment({
  shipment,
  canDispatch,
  canSettle,
  orderTotal,
}: {
  shipment: ShipmentView;
  canDispatch: boolean;
  canSettle: boolean;
  orderTotal: number;
}) {
  const [syncState, syncAction, syncing] = useActionState(syncShipmentAction, idleState);
  const [stepState, stepAction, savingStep] = useActionState(addTrackingStepAction, idleState);
  const [settleState, settleAction, settling] = useActionState(recordSettlementAction, idleState);
  useRefreshOnSuccess(syncState);
  useRefreshOnSuccess(stepState);
  useRefreshOnSuccess(settleState);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Parcel</h2>
        <StatusPill status={shipment.status} />
      </div>

      <div className="card-body stack">
        <FormFeedback state={syncState} />

        <dl className="detail-list">
          <div><dt>Courier</dt><dd>{shipment.courierName ?? "—"}</dd></div>
          <div>
            <dt>Tracking</dt>
            <dd>
              {shipment.trackingUrl ? (
                <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="link">
                  {shipment.trackingNumber}
                </a>
              ) : (
                shipment.trackingNumber ?? "—"
              )}
            </dd>
          </div>
          {shipment.currentLocation ? <div><dt>Location</dt><dd>{shipment.currentLocation}</dd></div> : null}
          {shipment.deliveryManName ? (
            <div>
              <dt>Rider</dt>
              <dd>
                {shipment.deliveryManName}
                {shipment.deliveryManPhone ? ` · ${shipment.deliveryManPhone}` : ""}
              </dd>
            </div>
          ) : null}
          {shipment.estimatedDeliveryAt ? (
            <div><dt>Expected</dt><dd>{formatDateTime(shipment.estimatedDeliveryAt)}</dd></div>
          ) : null}
          <div><dt>Courier charge</dt><dd>{formatMoney(shipment.courierCharge)}</dd></div>
          <div>
            <dt>Settlement</dt>
            <dd>
              <StatusPill status={shipment.settlementStatus} />
              {shipment.settledAmount > 0 ? ` ${formatMoney(shipment.settledAmount)} received` : ""}
            </dd>
          </div>
          {shipment.lastSyncedAt ? (
            <div><dt>Last checked</dt><dd>{formatDateTime(shipment.lastSyncedAt)}</dd></div>
          ) : null}
        </dl>

        {shipment.syncError ? (
          <div className="alert-warning" role="status">
            <div>Last automatic check failed: {shipment.syncError}</div>
          </div>
        ) : null}

        <div>
          <h3 className="mb-2 text-sm font-bold">Journey</h3>
          {shipment.events.length === 0 ? (
            <p className="muted-xs">No steps recorded yet.</p>
          ) : (
            <ol className="timeline">
              {[...shipment.events]
                .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
                .map((event) => (
                  <li key={event.id} className="timeline-item">
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{event.status.replace(/_/g, " ").toLowerCase()}</p>
                      {event.description ? <p className="muted-xs">{event.description}</p> : null}
                      <p className="muted-xs">
                        {formatDateTime(event.occurredAt)}
                        {event.location ? ` · ${event.location}` : ""}
                        {event.source !== "webhook" ? ` · ${event.source}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </div>
      </div>

      {canDispatch ? (
        <div className="card-footer flex-wrap gap-2">
          <form action={syncAction}>
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <SubmitButton pending={syncing} className="btn-secondary btn-sm">Refresh from courier</SubmitButton>
          </form>

          <form action={stepAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <label className="sr-only" htmlFor={`step-${shipment.id}`}>Set status by hand</label>
            <select id={`step-${shipment.id}`} name="status" className="select h-9 w-44 text-sm" defaultValue={shipment.status}>
              {MANUAL_SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{status.replace(/_/g, " ").toLowerCase()}</option>
              ))}
            </select>
            <input name="location" className="input h-9 w-32 text-sm" placeholder="Location" maxLength={120} />
            <SubmitButton pending={savingStep} className="btn-ghost btn-sm">Set by hand</SubmitButton>
          </form>
        </div>
      ) : null}

      {canSettle ? (
        <form action={settleAction} className="border-t border-line">
          <div className="card-body stack">
            <h3 className="text-sm font-bold">Record settlement</h3>
            <FormFeedback state={settleState} />
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <div className="grid-form-2">
              <Field label="Collected from customer" htmlFor={`collected-${shipment.id}`}>
                <input
                  id={`collected-${shipment.id}`}
                  name="collectedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  defaultValue={fromMinor(shipment.collectedAmount || orderTotal)}
                />
              </Field>
              <Field label="Courier charge" htmlFor={`charge-${shipment.id}`}>
                <input
                  id={`charge-${shipment.id}`}
                  name="courierCharge"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  defaultValue={fromMinor(shipment.courierCharge)}
                />
              </Field>
              <Field label="Received by us" htmlFor={`settled-${shipment.id}`} hint="What actually landed in the account.">
                <input
                  id={`settled-${shipment.id}`}
                  name="settledAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  defaultValue={fromMinor(Math.max(0, (shipment.collectedAmount || orderTotal) - shipment.courierCharge))}
                />
              </Field>
              <Field label="Note" htmlFor={`snote-${shipment.id}`}>
                <input id={`snote-${shipment.id}`} name="note" className="input" maxLength={300} />
              </Field>
            </div>
          </div>
          <div className="card-footer">
            <SubmitButton pending={settling} className="btn-secondary">Record settlement</SubmitButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
