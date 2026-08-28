import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Breadcrumb, EmptyState } from "@/components/ui";
import { CheckoutForm, type PaymentOption } from "@/components/site/checkout-form";
import { prisma } from "@/lib/db";
import { getCartView } from "@/lib/services/cart";
import { getDistricts } from "@/lib/services/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Checkout", path: "/checkout", noIndex: true });
}

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const couponCode = typeof params.coupon === "string" ? params.coupon : null;
  const districtId = typeof params.district === "string" ? params.district : null;

  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);

  // Guest checkout is a Super Admin switch (PRD §5).
  if (!user && (settings.features.requireLoginForCheckout || !settings.features.guestCheckoutEnabled)) {
    redirect("/login?next=/checkout");
  }

  const [cart, districts, addresses] = await Promise.all([
    getCartView({ couponCode, districtId, guestEmail: user?.email ?? null }),
    getDistricts(),
    user
      ? prisma.address.findMany({
          where: { userId: user.id, deletedAt: null },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: {
            id: true, label: true, fullName: true, phone: true, districtId: true, districtName: true,
            city: true, area: true, addressLine1: true, addressLine2: true, postalCode: true, isDefault: true,
          },
        })
      : Promise.resolve([]),
  ]);

  if (cart.isEmpty) {
    return (
      <div className="tm-container section">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Checkout" }]} />
        <h1 className="page-title mt-3 mb-6">Checkout</h1>
        <EmptyState
          title="Your cart is empty"
          description="Add a product before checking out."
          action={<Link href="/shop" className="btn-primary">Browse products</Link>}
        />
      </div>
    );
  }

  const paymentOptions: PaymentOption[] = [
    ...(settings.payment.codEnabled
      ? [{ value: "COD" as const, label: "Cash on Delivery", description: settings.payment.codInstructions }]
      : []),
    ...(settings.payment.bkashEnabled
      ? [{ value: "BKASH" as const, label: "bKash", description: settings.payment.bkashInstructions }]
      : []),
    ...(settings.payment.sslcommerzEnabled
      ? [{ value: "SSLCOMMERZ" as const, label: "Card / online payment", description: "Pay securely through our online gateway." }]
      : []),
  ];

  return (
    <div className="tm-container section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      <h1 className="page-title mt-3 mb-6">Checkout</h1>

      {paymentOptions.length === 0 ? (
        <div className="alert-danger">
          <div>No payment method is enabled. Please contact us on {settings.contact.phone} to place your order.</div>
        </div>
      ) : (
        <CheckoutForm
          cart={cart}
          districts={districts.map((district) => ({
            id: district.id,
            name: district.name,
            division: district.division,
            deliveryCharge: district.deliveryCharge,
            isFreeDelivery: district.isFreeDelivery,
          }))}
          addresses={addresses}
          paymentOptions={paymentOptions}
          bkashNumber={settings.payment.bkashMerchantNumber}
          user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
          isGuestAllowed={settings.features.guestCheckoutEnabled && !settings.features.requireLoginForCheckout}
          couponCode={couponCode}
          requirePhoneVerification={settings.features.checkoutOtpEnabled}
        />
      )}
    </div>
  );
}
