import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumb, EmptyState } from "@/components/ui";
import { CartLineRow, CouponBox } from "@/components/site/cart-client";
import { getCartView } from "@/lib/services/cart";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Your cart", path: "/cart", noIndex: true });
}

export default async function CartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const couponCode = typeof params.coupon === "string" ? params.coupon : null;

  const [cart, settings] = await Promise.all([getCartView({ couponCode }), getSettings()]);

  if (cart.isEmpty) {
    return (
      <div className="tm-container section">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
        <h1 className="page-title mt-3 mb-6">Your cart</h1>
        <EmptyState
          title="Your cart is empty"
          description="Browse the catalogue and add something you like."
          action={<Link href="/shop" className="btn-primary">Start shopping</Link>}
        />
      </div>
    );
  }

  const { quote } = cart;

  return (
    <div className="tm-container section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <h1 className="page-title mt-3 mb-6">Your cart</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">Price</th>
                <th>Quantity</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.lines.map((line) => (
                <CartLineRow key={line.itemId} line={line} />
              ))}
            </tbody>
          </table>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card-header"><h2 className="card-title">Order summary</h2></div>
            <div className="card-body">
              <div className="summary-row">
                <span>Subtotal ({quote.itemCount} item{quote.itemCount === 1 ? "" : "s"})</span>
                <span>{formatMoney(quote.subtotal)}</span>
              </div>
              {quote.flashDiscount > 0 ? (
                <div className="summary-row text-success-700">
                  <span>Flash sale discount</span>
                  <span>−{formatMoney(quote.flashDiscount)}</span>
                </div>
              ) : null}
              {quote.offerDiscount > 0 ? (
                <div className="summary-row text-success-700">
                  <span>Offer discount</span>
                  <span>−{formatMoney(quote.offerDiscount)}</span>
                </div>
              ) : null}
              {quote.couponDiscount > 0 ? (
                <div className="summary-row text-success-700">
                  <span>Coupon {quote.coupon?.code}</span>
                  <span>−{formatMoney(quote.couponDiscount)}</span>
                </div>
              ) : null}
              <div className="summary-row">
                <span>Delivery {quote.shipping.districtName ? `(${quote.shipping.districtName})` : "(estimated)"}</span>
                <span>{quote.shipping.total === 0 ? "Free" : formatMoney(quote.shipping.total)}</span>
              </div>
              <div className="summary-row-total">
                <span>Total</span>
                <span>{formatMoney(quote.grandTotal)}</span>
              </div>

              <p className="form-hint mt-2">
                Final delivery charge is confirmed when you select your district at checkout.
              </p>

              <div className="mt-4">
                <CouponBox
                  // Only a coupon the server actually accepted counts as applied.
                  appliedCode={quote.coupon?.code ?? null}
                  attemptedCode={couponCode}
                  error={quote.couponError}
                  discount={quote.couponDiscount}
                />
              </div>

              <Link
                href={`/checkout${couponCode ? `?coupon=${encodeURIComponent(couponCode)}` : ""}`}
                className="btn-primary btn-block btn-lg mt-4"
                aria-disabled={cart.hasUnavailable}
              >
                Proceed to checkout
              </Link>

              {cart.hasUnavailable ? (
                <p className="form-error mt-2">Remove unavailable items before checking out.</p>
              ) : null}

              <Link href="/shop" className="btn-ghost btn-block btn-sm mt-2">Continue shopping</Link>
            </div>
          </div>

          <div className="panel text-xs text-brand-600">
            <p className="font-semibold text-brand-800">{settings.payment.codEnabled ? "Cash on delivery available" : "Secure checkout"}</p>
            <p className="mt-1">{settings.shipping.note}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
