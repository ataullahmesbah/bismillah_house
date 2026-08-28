import { formatDateTime, humanizeEnum } from "@/lib/utils";

export type ParcelStep = {
  status: string;
  description: string | null;
  location: string | null;
  occurredAt: Date;
};

export type ParcelView = {
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  currentLocation: string | null;
  estimatedDeliveryAt: Date | null;
  deliveredAt: Date | null;
  steps: ParcelStep[];
};

/**
 * Where the customer's parcel is, in their own words.
 *
 * Everything shown here is already visible to whoever holds the order — the
 * courier's own tracking page shows the same thing — so nothing internal
 * (charges, settlement, the rider's phone number) appears.
 */
export function ParcelJourney({ parcel }: { parcel: ParcelView }) {
  if (!parcel.trackingNumber && parcel.steps.length === 0) return null;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Parcel tracking</h2>
        {parcel.trackingUrl ? (
          <a
            href={parcel.trackingUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-ghost btn-xs"
          >
            Open courier site
          </a>
        ) : null}
      </div>

      <div className="card-body stack">
        <dl className="detail-list">
          <div><dt>Courier</dt><dd>{parcel.courierName ?? "—"}</dd></div>
          {parcel.trackingNumber ? (
            <div><dt>Tracking number</dt><dd className="mono text-xs">{parcel.trackingNumber}</dd></div>
          ) : null}
          <div><dt>Status</dt><dd>{humanizeEnum(parcel.status)}</dd></div>
          {parcel.currentLocation ? (
            <div><dt>Last seen</dt><dd>{parcel.currentLocation}</dd></div>
          ) : null}
          {parcel.deliveredAt ? (
            <div><dt>Delivered</dt><dd>{formatDateTime(parcel.deliveredAt)}</dd></div>
          ) : parcel.estimatedDeliveryAt ? (
            <div><dt>Expected</dt><dd>{formatDateTime(parcel.estimatedDeliveryAt)}</dd></div>
          ) : null}
        </dl>

        {parcel.steps.length > 0 ? (
          <ol className="timeline">
            {parcel.steps.map((step, index) => (
              <li key={`${step.status}-${index}`} className="timeline-item">
                <span className="timeline-dot" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{humanizeEnum(step.status)}</p>
                  {step.description ? <p className="muted-xs">{step.description}</p> : null}
                  <p className="muted-xs">
                    {formatDateTime(step.occurredAt)}
                    {step.location ? ` · ${step.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
