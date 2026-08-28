import { formatMoney } from "@/lib/money";
import { formatDateTime, humanizeEnum } from "@/lib/utils";
import type { InvoiceSnapshot } from "@/lib/services/orders";

/**
 * Print-optimised invoice, suitable for putting on a delivery package.
 * Rendered from the immutable invoice snapshot, never from live product rows.
 */
export function InvoiceSheet({
  snapshot,
  shop,
}: {
  snapshot: InvoiceSnapshot;
  shop: { name: string; address: string; phone: string; email: string };
}) {
  const address = snapshot.shippingAddress as Record<string, string | null>;

  return (
    <div className="print-sheet card">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <p className="text-2xl font-extrabold tracking-tight">{shop.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
            {shop.address}
            <br />
            {shop.phone} · {shop.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold tracking-tight">INVOICE</p>
          <p className="mt-1 font-mono text-xs">{snapshot.invoiceNumber}</p>
          <p className="text-xs text-neutral-600">Order {snapshot.order.orderNumber}</p>
          <p className="text-xs text-neutral-600">{formatDateTime(snapshot.issuedAt)}</p>
        </div>
      </header>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Bill to</p>
          <p className="mt-1 font-semibold">{snapshot.customer.name}</p>
          <p className="text-xs text-neutral-700">{snapshot.customer.phone}</p>
          {snapshot.customer.email ? <p className="text-xs text-neutral-700">{snapshot.customer.email}</p> : null}
        </div>
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Deliver to</p>
          <p className="mt-1 font-semibold">{address.fullName ?? snapshot.customer.name}</p>
          <p className="text-xs leading-relaxed text-neutral-700">
            {address.phone}
            <br />
            {address.addressLine1}
            {address.area ? `, ${address.area}` : ""}
            {address.city ? `, ${address.city}` : ""}
            <br />
            {address.district}
            {address.postalCode ? ` — ${address.postalCode}` : ""}
          </p>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2 border-y border-neutral-300 py-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Order date</p>
          <p className="font-semibold">{formatDateTime(snapshot.order.placedAt)}</p>
        </div>
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Payment</p>
          <p className="font-semibold">{humanizeEnum(snapshot.order.paymentMethod)}</p>
        </div>
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Payment status</p>
          <p className="font-semibold">{humanizeEnum(snapshot.order.paymentStatus)}</p>
        </div>
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Order status</p>
          <p className="font-semibold">{humanizeEnum(snapshot.order.status)}</p>
        </div>
      </section>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="py-2 text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Item</th>
            <th className="py-2 text-center text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Qty</th>
            <th className="py-2 text-right text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Unit price</th>
            <th className="py-2 text-right text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">Amount</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.items.map((item, index) => (
            <tr key={index} className="border-b border-neutral-200 align-top">
              <td className="py-2">
                <span className="font-semibold">{item.name}</span>
                {item.variantName ? <span className="block text-neutral-600">{item.variantName}</span> : null}
                {item.sku ? <span className="block font-mono text-[0.625rem] text-neutral-500">SKU {item.sku}</span> : null}
                {item.discount > 0 ? (
                  <span className="block text-neutral-600">Discount −{formatMoney(item.discount)}</span>
                ) : null}
              </td>
              <td className="py-2 text-center tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-1 text-xs">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatMoney(snapshot.totals.subtotal)}</dd></div>
          {snapshot.totals.itemDiscount > 0 ? (
            <div className="flex justify-between"><dt>Flash sale discount</dt><dd className="tabular-nums">−{formatMoney(snapshot.totals.itemDiscount)}</dd></div>
          ) : null}
          {snapshot.totals.offerDiscount > 0 ? (
            <div className="flex justify-between"><dt>Offer discount</dt><dd className="tabular-nums">−{formatMoney(snapshot.totals.offerDiscount)}</dd></div>
          ) : null}
          {snapshot.totals.couponDiscount > 0 ? (
            <div className="flex justify-between">
              <dt>Coupon {snapshot.coupon?.code}</dt>
              <dd className="tabular-nums">−{formatMoney(snapshot.totals.couponDiscount)}</dd>
            </div>
          ) : null}
          {snapshot.totals.totalDiscount > 0 ? (
            <div className="flex justify-between font-medium"><dt>Total discount</dt><dd className="tabular-nums">−{formatMoney(snapshot.totals.totalDiscount)}</dd></div>
          ) : null}
          <div className="flex justify-between">
            <dt>Delivery charge</dt>
            <dd className="tabular-nums">{snapshot.totals.shipping === 0 ? "Free" : formatMoney(snapshot.totals.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-neutral-400 pt-2 text-sm font-extrabold">
            <dt>Total payable</dt><dd className="tabular-nums">{formatMoney(snapshot.totals.grandTotal)}</dd>
          </div>
        </dl>
      </section>

      {snapshot.order.paymentMethod === "COD" ? (
        <p className="mt-3 border border-neutral-400 p-2 text-center text-xs font-bold">
          CASH ON DELIVERY — COLLECT {formatMoney(snapshot.totals.grandTotal)}
        </p>
      ) : null}

      {snapshot.order.customerNote ? (
        <p className="mt-3 text-xs text-neutral-600">Customer note: {snapshot.order.customerNote}</p>
      ) : null}

      <footer className="mt-6 border-t border-neutral-300 pt-3 text-center text-[0.625rem] text-neutral-500">
        Thank you for shopping with {shop.name}. Keep this invoice for warranty and returns.
      </footer>
    </div>
  );
}
