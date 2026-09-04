import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, StatusPill } from "@/components/ui";
import {
  FraudFlagPanel, InternalNotePanel, OrderStatusPanel, PaymentPanel,
} from "@/components/dashboard/order-panels";
import { CourierPanel } from "@/components/dashboard/courier-panel";
import { getCourierAdapter, credentialsFor } from "@/lib/courier/adapters";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { ORDER_STATUS_TRANSITIONS, PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanizeEnum, maskEmail, maskPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DashboardOrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requirePermissionPage(PERMISSIONS.ORDER_VIEW, "/dashboard/orders");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusEvents: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" } },
      shipments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { events: { orderBy: { occurredAt: "desc" }, take: 40 } },
      },
      invoice: { select: { invoiceNumber: true, issuedAt: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) notFound();

  const [
    courierRows, canUpdateStatus, canNote, canRefundOrder, canFraud, canContact, canInvoice,
    canDispatch, canSettle,
  ] = await Promise.all([
    prisma.courier.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, code: true, provider: true, apiBaseUrl: true },
    }),
    userHasPermission(user, PERMISSIONS.ORDER_UPDATE_STATUS),
    userHasPermission(user, PERMISSIONS.ORDER_INTERNAL_NOTE),
    userHasPermission(user, PERMISSIONS.ORDER_REFUND),
    userHasPermission(user, PERMISSIONS.ORDER_FRAUD_REVIEW),
    userHasPermission(user, PERMISSIONS.ORDER_VIEW_CONTACT),
    userHasPermission(user, PERMISSIONS.ORDER_INVOICE),
    userHasPermission(user, PERMISSIONS.COURIER_DISPATCH),
    userHasPermission(user, PERMISSIONS.COURIER_SETTLEMENT),
  ]);

  // Whether a courier can actually be driven from here depends on both the
  // adapter and the credentials being present — the panel offers the manual
  // route rather than a button that will only ever fail.
  const couriers = courierRows.map((courier) => ({
    id: courier.id,
    name: courier.name,
    provider: courier.provider,
    hasApi: getCourierAdapter(courier.provider).supportsApi && credentialsFor(courier.code, courier.apiBaseUrl) !== null,
  }));

  const address = (order.shippingAddress ?? {}) as Record<string, string | null>;
  const shippingSnapshot = (order.shippingSnapshot ?? {}) as {
    breakdown?: Array<{ label: string; amount: number; mode: string; note?: string }>;
    strategy?: string;
    districtCharge?: number;
    freeReason?: string | null;
  };
  const shipment = order.shipments[0] ?? null;

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.placedAt)} · ${order.items.length} item(s)`}
        action={
          <div className="flex flex-wrap gap-2">
            {canInvoice ? (
              <>
                <a href={`/api/orders/${order.id}/invoice`} className="btn-primary btn-sm" target="_blank" rel="noopener noreferrer">
                  Download invoice PDF
                </a>
                <Link href={`/dashboard/orders/${order.id}/invoice`} className="btn-secondary btn-sm">Print invoice</Link>
              </>
            ) : null}
            <Link href="/dashboard/orders" className="btn-ghost btn-sm">← All orders</Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill status={order.status} />
        <StatusPill status={order.paymentStatus} />
        <span className="badge-outline">{humanizeEnum(order.paymentMethod)}</span>
        {order.isFlagged ? <span className="badge-red">Fraud review</span> : null}
        {order.invoice ? <span className="badge-outline mono">{order.invoice.invoiceNumber}</span> : null}
        {order.couponCode ? <span className="badge-accent">Coupon {order.couponCode}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Items</h2></div>
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr><th>Product</th><th className="text-right">Unit</th><th className="text-right">Qty</th><th className="text-right">Discount</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          {item.imageUrl ? (
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-line bg-white">
                              <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-contain" />
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            {item.productSlug ? (
                              <Link href={`/product/${item.productSlug}`} className="clamp-1 font-medium hover:underline" target="_blank">
                                {item.productName}
                              </Link>
                            ) : (
                              <span className="clamp-1 font-medium">{item.productName}</span>
                            )}
                            {item.variantName ? <p className="muted-xs">{item.variantName}</p> : null}
                            {item.sku ? <p className="mono text-xs text-brand-400">{item.sku}</p> : null}
                            {item.shippingMode !== "STANDARD" ? (
                              <p className="muted-xs">
                                {item.shippingMode === "FREE" ? "Free delivery item" : `Item delivery ${formatMoney(item.shippingFee)}`}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="td-num">{formatMoney(item.unitPrice)}</td>
                      <td className="td-num">{item.quantity}</td>
                      <td className="td-num">{item.discountAmount > 0 ? `−${formatMoney(item.discountAmount)}` : "—"}</td>
                      <td className="td-num font-semibold">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-footer flex-col items-stretch">
              <div className="ml-auto w-full max-w-xs">
                <div className="summary-row"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
                {order.itemDiscountTotal > 0 ? (
                  <div className="summary-row text-success-700"><span>Flash sale</span><span>−{formatMoney(order.itemDiscountTotal)}</span></div>
                ) : null}
                {order.offerDiscount > 0 ? (
                  <div className="summary-row text-success-700"><span>Offer</span><span>−{formatMoney(order.offerDiscount)}</span></div>
                ) : null}
                {order.couponDiscount > 0 ? (
                  <div className="summary-row text-success-700">
                    <span>Coupon {order.couponCode}</span><span>−{formatMoney(order.couponDiscount)}</span>
                  </div>
                ) : null}
                <div className="summary-row"><span>Delivery — {order.districtName}</span><span>{formatMoney(order.shippingTotal)}</span></div>
                <div className="summary-row-total"><span>Total</span><span>{formatMoney(order.grandTotal)}</span></div>
              </div>
            </div>
          </section>

          {shippingSnapshot.breakdown && shippingSnapshot.breakdown.length > 0 ? (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Delivery calculation</h2>
                <span className="muted-xs">Strategy: {shippingSnapshot.strategy ?? "highest"}</span>
              </div>
              <div className="card-body">
                <ul className="space-y-1.5 text-sm">
                  {shippingSnapshot.breakdown.map((entry, index) => (
                    <li key={index} className="row-between">
                      <span className="text-brand-600">
                        {entry.label}
                        {entry.note ? <span className="muted-xs block">{entry.note}</span> : null}
                      </span>
                      <span className="font-medium tabular-nums">{formatMoney(entry.amount)}</span>
                    </li>
                  ))}
                </ul>
                {shippingSnapshot.freeReason ? (
                  <p className="mt-2 text-xs font-semibold text-success-700">{shippingSnapshot.freeReason}</p>
                ) : null}
                <p className="form-hint mt-2">
                  This snapshot is what the customer was charged, preserved exactly as calculated at checkout.
                </p>
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-header"><h2 className="card-title">Timeline</h2></div>
            <div className="card-body">
              <ol className="relative space-y-4 border-l border-line pl-5">
                {order.statusEvents.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand-900" aria-hidden="true" />
                    <p className="text-sm font-semibold">
                      {event.fromStatus ? `${humanizeEnum(event.fromStatus)} → ` : ""}
                      {humanizeEnum(event.toStatus)}
                    </p>
                    <p className="muted-xs">
                      {formatDateTime(event.createdAt)}
                      {event.actorName ? ` · ${event.actorName}` : ""}
                      {event.actorRole ? ` (${event.actorRole})` : ""}
                    </p>
                    {event.note ? <p className="mt-0.5 text-xs text-brand-600">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {order.refunds.length > 0 ? (
            <section className="card">
              <div className="card-header"><h2 className="card-title">Refunds</h2></div>
              <div className="table-wrap border-0">
                <table className="table table-compact">
                  <thead><tr><th>When</th><th>Reason</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {order.refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td className="text-xs">{formatDateTime(refund.createdAt)}</td>
                        <td className="text-xs">{refund.reason ?? "—"}</td>
                        <td><span className="badge-outline">{refund.status}</span></td>
                        <td className="td-num">{formatMoney(refund.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {canNote ? <InternalNotePanel orderId={order.id} notes={order.internalNote} /> : null}
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Customer</h2></div>
            <div className="card-body space-y-2 text-sm">
              <p className="font-semibold text-brand-900">{order.customerName}</p>
              <p className="text-brand-600">
                {canContact ? order.customerPhone : maskPhone(order.customerPhone)}
                {order.customerEmail ? (
                  <>
                    <br />
                    {canContact ? order.customerEmail : maskEmail(order.customerEmail)}
                  </>
                ) : null}
              </p>
              {!canContact ? <p className="form-hint">Full contact details require the “view customer contact” permission.</p> : null}

              <div className="divider" />
              <p className="stat-label">Delivery address</p>
              <p className="text-brand-600">
                {address.addressLine1}
                {address.area ? `, ${address.area}` : ""}
                {address.city ? `, ${address.city}` : ""}
                <br />
                {order.districtName}
                {address.postalCode ? ` — ${address.postalCode}` : ""}
              </p>

              {order.customerNote ? (
                <>
                  <div className="divider" />
                  <p className="stat-label">Customer note</p>
                  <p className="text-brand-600">{order.customerNote}</p>
                </>
              ) : null}

              <div className="divider" />
              <div className="flex flex-wrap gap-2">
                {order.user ? (
                  <Link href={`/dashboard/customers/${order.user.id}`} className="btn-secondary btn-xs">Customer profile</Link>
                ) : (
                  <span className="badge-gray">Guest order</span>
                )}
                <Link
                  href={`/dashboard/customer-search?q=${encodeURIComponent(order.customerPhone)}`}
                  className="btn-ghost btn-xs"
                >
                  Order history
                </Link>
              </div>
            </div>
          </section>

          {canUpdateStatus ? (
            <OrderStatusPanel
              orderId={order.id}
              currentStatus={order.status}
              allowedStatuses={ORDER_STATUS_TRANSITIONS[order.status] ?? []}
            />
          ) : null}

          <PaymentPanel
            orderId={order.id}
            paymentStatus={order.paymentStatus}
            grandTotal={order.grandTotal}
            paidTotal={order.paidTotal}
            refundedTotal={order.refundedTotal}
            canRefund={canRefundOrder}
            attempts={order.payments.map((payment) => ({
              id: payment.id,
              provider: payment.provider,
              transactionId: payment.transactionId,
              senderNumber: payment.senderNumber,
            }))}
          />

          <CourierPanel
            orderId={order.id}
            couriers={couriers}
            canDispatch={canDispatch}
            canSettle={canSettle}
            orderTotal={order.grandTotal}
            outstanding={Math.max(0, order.grandTotal - order.paidTotal)}
            shipment={
              shipment
                ? {
                  id: shipment.id,
                  courierName: shipment.courierName,
                  trackingNumber: shipment.trackingNumber,
                  trackingUrl: shipment.trackingUrl,
                  consignmentId: shipment.consignmentId,
                  status: shipment.status,
                  currentLocation: shipment.currentLocation,
                  deliveryManName: shipment.deliveryManName,
                  deliveryManPhone: shipment.deliveryManPhone,
                  estimatedDeliveryAt: shipment.estimatedDeliveryAt,
                  pickupAt: shipment.pickupAt,
                  deliveredAt: shipment.deliveredAt,
                  courierCharge: shipment.courierCharge,
                  collectedAmount: shipment.collectedAmount,
                  settledAmount: shipment.settledAmount,
                  settlementStatus: shipment.settlementStatus,
                  lastSyncedAt: shipment.lastSyncedAt,
                  syncError: shipment.syncError,
                  events: shipment.events.map((event) => ({
                    id: event.id,
                    status: event.status,
                    description: event.description,
                    location: event.location,
                    occurredAt: event.occurredAt,
                    source: event.source,
                  })),
                }
                : null
            }
          />

          {canFraud ? (
            <FraudFlagPanel orderId={order.id} isFlagged={order.isFlagged} flagReason={order.flagReason} />
          ) : null}
        </aside>
      </div>
    </>
  );
}
