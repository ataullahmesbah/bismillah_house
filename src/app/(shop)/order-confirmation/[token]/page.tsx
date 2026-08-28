import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/ui";
import { OrderPlacedTracking } from "@/components/site/order-tracking-events";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

type Params = Promise<{ token: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Order confirmed", path: "/order-confirmation", noIndex: true });
}

/**
 * Confirmation is addressed by a non-guessable token, never by order id, so a
 * guest cannot walk the URL space to another customer's order (PRD §41).
 */
export default async function OrderConfirmationPage({ params }: { params: Params }) {
  const { token } = await params;

  const order = await prisma.order.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: {
      id: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true,
      grandTotal: true, subtotal: true, shippingTotal: true, couponDiscount: true,
      itemDiscountTotal: true, offerDiscount: true, placedAt: true, customerName: true,
      customerPhone: true, districtName: true, shippingAddress: true, publicToken: true,
      items: {
        select: {
          id: true, productName: true, variantName: true, quantity: true,
          unitPrice: true, lineTotal: true, productSlug: true,
        },
      },
      invoice: { select: { invoiceNumber: true } },
    },
  });

  if (!order) notFound();

  const settings = await getSettings();
  const address = (order.shippingAddress ?? {}) as Record<string, string | null>;

  return (
    <div className="tm-container section">
      <div className="mx-auto max-w-3xl">
        <div className="card text-center">
          <div className="card-body">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-100 text-success-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Thank you, {order.customerName.split(" ")[0]}!</h1>
            <p className="mt-1.5 text-sm text-brand-600">
              Your order has been placed. We will call {order.customerPhone} to confirm delivery.
            </p>
            <p className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
              <span className="badge-dark">Order {order.orderNumber}</span>
              <StatusPill status={order.status} />
              <StatusPill status={order.paymentStatus} />
            </p>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header">
            <h2 className="card-title">Order summary</h2>
            <span className="muted-xs">{formatDateTime(order.placedAt)}</span>
          </div>
          <div className="card-body">
            <ul className="space-y-2">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    {item.productSlug ? (
                      <Link href={`/product/${item.productSlug}`} className="font-medium hover:underline">{item.productName}</Link>
                    ) : (
                      <span className="font-medium">{item.productName}</span>
                    )}
                    {item.variantName ? <span className="block text-xs text-brand-500">{item.variantName}</span> : null}
                    <span className="block text-xs text-brand-500">
                      {item.quantity} × {formatMoney(item.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-line pt-3">
              <div className="summary-row"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
              {order.itemDiscountTotal + order.offerDiscount > 0 ? (
                <div className="summary-row text-success-600">
                  <span>Offers</span><span>−{formatMoney(order.itemDiscountTotal + order.offerDiscount)}</span>
                </div>
              ) : null}
              {order.couponDiscount > 0 ? (
                <div className="summary-row text-success-600"><span>Coupon</span><span>−{formatMoney(order.couponDiscount)}</span></div>
              ) : null}
              <div className="summary-row">
                <span>Delivery — {order.districtName}</span>
                <span>{order.shippingTotal === 0 ? "Free" : formatMoney(order.shippingTotal)}</span>
              </div>
              <div className="summary-row-total">
                <span>{order.paymentMethod === "COD" ? "Payable on delivery" : "Total"}</span>
                <span>{formatMoney(order.grandTotal)}</span>
              </div>
            </div>

            <div className="panel mt-4 text-sm">
              <p className="font-semibold text-brand-800">Delivery address</p>
              <p className="mt-1 text-brand-600">
                {address.fullName}, {address.phone}
                <br />
                {address.addressLine1}
                {address.area ? `, ${address.area}` : ""}
                {address.city ? `, ${address.city}` : ""}
                <br />
                {order.districtName}
                {address.postalCode ? ` — ${address.postalCode}` : ""}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/track-order?ref=${order.orderNumber}`} className="btn-primary">Track this order</Link>
              <a href={`/api/orders/${order.publicToken}/invoice`} className="btn-secondary" target="_blank" rel="noopener noreferrer">
                Download invoice (PDF)
              </a>
              <Link href="/shop" className="btn-ghost">Continue shopping</Link>
            </div>

            {order.invoice ? (
              <p className="form-hint mt-3">Invoice number: <span className="mono">{order.invoice.invoiceNumber}</span></p>
            ) : null}
            <p className="form-hint mt-1">
              Questions? Call {settings.contact.phone} or <Link href="/contact" className="link">message support</Link>.
            </p>
          </div>
        </div>
      </div>

      <OrderPlacedTracking
        orderNumber={order.orderNumber}
        value={order.grandTotal / 100}
        items={order.items.map((item) => ({
          item_id: item.id,
          item_name: item.productName,
          price: item.unitPrice / 100,
          quantity: item.quantity,
        }))}
      />
    </div>
  );
}
