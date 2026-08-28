import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, StatusPill } from "@/components/ui";
import { CancelOrderButton } from "@/components/site/order-actions";
import { ParcelJourney } from "@/components/site/parcel-journey";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getSettings, getSettingGroup } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanizeEnum } from "@/lib/utils";
import { CUSTOMER_CANCELLABLE_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Order details", path: "/account/orders", noIndex: true });
}

export default async function AccountOrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser();

  // Scoped by userId — changing the id in the URL cannot reach another
  // customer's order (IDOR protection, PRD §6).
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: {
      id: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true,
      subtotal: true, itemDiscountTotal: true, offerDiscount: true, couponDiscount: true,
      shippingTotal: true, grandTotal: true, couponCode: true, placedAt: true,
      customerNote: true, districtName: true, shippingAddress: true, cancelReason: true,
      items: {
        select: {
          id: true, productName: true, productSlug: true, variantName: true, sku: true,
          imageUrl: true, quantity: true, unitPrice: true, lineTotal: true, productId: true,
          reviews: { select: { id: true, status: true } },
        },
      },
      statusEvents: { orderBy: { createdAt: "asc" }, select: { toStatus: true, note: true, createdAt: true } },
      shipments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          courierName: true, trackingNumber: true, trackingUrl: true, status: true,
          currentLocation: true, estimatedDeliveryAt: true, deliveredAt: true,
          events: {
            orderBy: { occurredAt: "desc" },
            take: 30,
            select: { status: true, description: true, location: true, occurredAt: true },
          },
        },
      },
      invoice: { select: { invoiceNumber: true } },
    },
  });

  if (!order) notFound();

  // The shop can switch customer-facing tracking off — some prefer to keep
  // the courier relationship out of sight.
  const showTracking = (await getSettingGroup("courier")).customerTrackingEnabled;
  const address = (order.shippingAddress ?? {}) as Record<string, string | null>;
  const shipment = order.shipments[0];
  const canCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(order.status);

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.placedAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/orders/${order.id}/invoice`} className="btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">
              Download invoice
            </a>
            <Link href={`/account/orders/${order.id}/invoice`} className="btn-ghost btn-sm">Print view</Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusPill status={order.status} />
        <StatusPill status={order.paymentStatus} />
        <span className="badge-outline">{humanizeEnum(order.paymentMethod)}</span>
        {order.invoice ? <span className="badge-outline mono">{order.invoice.invoiceNumber}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Items</h2></div>
            <div className="card-body stack">
              {order.items.map((item) => {
                const review = item.reviews[0];
                return (
                  <div key={item.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-tm)] border border-line bg-white">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.productName} fill sizes="64px" className="object-contain" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.productSlug ? (
                        <Link href={`/product/${item.productSlug}`} className="text-sm font-semibold hover:underline">
                          {item.productName}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold">{item.productName}</p>
                      )}
                      {item.variantName ? <p className="muted-xs">{item.variantName}</p> : null}
                      {item.sku ? <p className="mono text-xs text-brand-400">SKU {item.sku}</p> : null}
                      <p className="muted-xs">{item.quantity} × {formatMoney(item.unitPrice)}</p>

                      {order.status === "DELIVERED" && item.productId ? (
                        review ? (
                          <p className="mt-1 text-xs font-semibold text-brand-500">
                            {review.status === "APPROVED" ? "Review published" : "Review awaiting approval"}
                          </p>
                        ) : (
                          <Link href={`/account/reviews?item=${item.id}`} className="btn-link mt-1 text-xs">
                            Write a review →
                          </Link>
                        )
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(item.lineTotal)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Delivery timeline</h2></div>
            <div className="card-body">
              <ol className="relative space-y-4 border-l border-line pl-5">
                {order.statusEvents.map((event, index) => (
                  <li key={index} className="relative">
                    <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand-900" aria-hidden="true" />
                    <p className="text-sm font-semibold">{ORDER_STATUS_LABELS[event.toStatus]}</p>
                    <p className="muted-xs">{formatDateTime(event.createdAt)}</p>
                    {event.note ? <p className="mt-0.5 text-xs text-brand-600">{event.note}</p> : null}
                  </li>
                ))}
              </ol>

              {canCancel ? <div className="mt-4"><CancelOrderButton orderId={order.id} /></div> : null}
              {order.cancelReason ? (
                <p className="mt-3 text-xs text-brand-500">Cancellation reason: {order.cancelReason}</p>
              ) : null}
            </div>
          </section>

          {shipment && showTracking ? (
            <ParcelJourney
              parcel={{
                courierName: shipment.courierName,
                trackingNumber: shipment.trackingNumber,
                trackingUrl: shipment.trackingUrl,
                status: shipment.status,
                currentLocation: shipment.currentLocation,
                estimatedDeliveryAt: shipment.estimatedDeliveryAt,
                deliveredAt: shipment.deliveredAt,
                steps: shipment.events,
              }}
            />
          ) : null}
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Payment summary</h2></div>
            <div className="card-body">
              <div className="summary-row"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
              {order.itemDiscountTotal > 0 ? (
                <div className="summary-row text-success-600"><span>Flash sale</span><span>−{formatMoney(order.itemDiscountTotal)}</span></div>
              ) : null}
              {order.offerDiscount > 0 ? (
                <div className="summary-row text-success-600"><span>Offer</span><span>−{formatMoney(order.offerDiscount)}</span></div>
              ) : null}
              {order.couponDiscount > 0 ? (
                <div className="summary-row text-success-600">
                  <span>Coupon {order.couponCode}</span><span>−{formatMoney(order.couponDiscount)}</span>
                </div>
              ) : null}
              <div className="summary-row">
                <span>Delivery — {order.districtName}</span>
                <span>{order.shippingTotal === 0 ? "Free" : formatMoney(order.shippingTotal)}</span>
              </div>
              <div className="summary-row-total"><span>Total</span><span>{formatMoney(order.grandTotal)}</span></div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Delivery address</h2></div>
            <div className="card-body text-sm text-brand-600">
              <p className="font-semibold text-brand-900">{address.fullName}</p>
              <p>{address.phone}</p>
              <p className="mt-1">
                {address.addressLine1}
                {address.area ? `, ${address.area}` : ""}
                {address.city ? `, ${address.city}` : ""}
                <br />
                {order.districtName}
                {address.postalCode ? ` — ${address.postalCode}` : ""}
              </p>
              {order.customerNote ? (
                <p className="mt-3 border-t border-line pt-2 text-xs">Your note: {order.customerNote}</p>
              ) : null}
            </div>
          </section>

          <Link href="/account/messages" className="card-hover p-4 text-sm">
            <p className="font-semibold">Problem with this order?</p>
            <p className="muted-xs mt-1">Message our support team and we will help.</p>
          </Link>
        </aside>
      </div>
    </>
  );
}
