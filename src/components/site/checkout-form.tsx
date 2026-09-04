"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { placeOrderAction } from "@/app/actions/checkout";
import { Field } from "@/components/ui";
import { idleState } from "@/lib/api";
import { PhoneVerification } from "./phone-verification";
import { usePreservedForm } from "@/lib/hooks/use-preserved-form";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartView } from "@/lib/services/cart";

export type CheckoutDistrict = {
  id: string;
  name: string;
  division: string;
  deliveryCharge: number;
  isFreeDelivery: boolean;
};

export type CheckoutAddress = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  districtId: string | null;
  districtName: string;
  city: string | null;
  area: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string | null;
  isDefault: boolean;
};

export type PaymentOption = { value: "COD" | "BKASH" | "SSLCOMMERZ"; label: string; description: string };

export function CheckoutForm({
  cart,
  districts,
  addresses,
  paymentOptions,
  bkashNumber,
  user,
  isGuestAllowed,
  couponCode,
  requirePhoneVerification = false,
}: {
  cart: CartView;
  districts: CheckoutDistrict[];
  addresses: CheckoutAddress[];
  paymentOptions: PaymentOption[];
  bkashNumber: string;
  user: { name: string; email: string; phone: string | null } | null;
  isGuestAllowed: boolean;
  couponCode: string | null;
  /** Shop setting: confirm the mobile number by SMS before accepting an order. */
  requirePhoneVerification?: boolean;
}) {
  const [state, formAction, pending] = useActionState(placeOrderAction, idleState);
  const { formProps } = usePreservedForm(state);
  const router = useRouter();
  const params = useSearchParams();

  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;
  // Controlled so the verification step can react to the number being edited.
  const [phone, setPhone] = useState(user?.phone ?? defaultAddress?.phone ?? "");
  // Tied to the number, so editing the field withdraws the verification.
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const phoneVerified = verifiedPhone !== null && verifiedPhone === phone;
  const [addressId, setAddressId] = useState<string>(defaultAddress?.id ?? "");
  const [districtId, setDistrictId] = useState<string>(
    params.get("district") ?? defaultAddress?.districtId ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentOption["value"]>(paymentOptions[0]?.value ?? "COD");

  const fields = state.status === "error" ? (state.fields ?? {}) : {};
  const useNewAddress = addressId === "";

  /** Re-quote on the server whenever the district changes. */
  function changeDistrict(nextId: string) {
    setDistrictId(nextId);
    const next = new URLSearchParams(params.toString());
    if (nextId) next.set("district", nextId);
    else next.delete("district");
    router.replace(`/checkout?${next.toString()}`);
    router.refresh();
  }

  const grouped = districts.reduce<Record<string, CheckoutDistrict[]>>((acc, district) => {
    (acc[district.division] ||= []).push(district);
    return acc;
  }, {});

  return (
    <form {...formProps} action={formAction} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="couponCode" value={couponCode ?? ""} />

      <div className="stack">
        {state.status === "error" ? (
          <div className="alert-danger" role="alert">
            <div className="min-w-0 flex-1">{state.message}</div>
          </div>
        ) : null}

        {!user && !isGuestAllowed ? (
          <div className="alert-warning">
            <div>
              Sign in to complete your order.{" "}
              <Link href="/login?next=/checkout" className="link">Sign in</Link>
            </div>
          </div>
        ) : null}

        {/* Contact */}
        <section className="card">
          <div className="card-header"><h2 className="card-title">1. Contact details</h2></div>
          <div className="card-body grid-form-2">
            <Field label="Full name" htmlFor="fullName" required error={fields.fullName}>
              <input id="fullName" name="fullName" className="input" defaultValue={user?.name ?? defaultAddress?.fullName ?? ""} required maxLength={120} autoComplete="name" />
            </Field>
            <Field label="Mobile number" htmlFor="phone" required error={fields.phone} hint="We will call this number to confirm delivery.">
              <input
                id="phone"
                name="phone"
                className="input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                autoComplete="tel"
              />
            </Field>
            <Field label="Email (optional)" htmlFor="email" error={fields.email} hint="For your order confirmation and invoice.">
              <input id="email" name="email" type="email" className="input" defaultValue={user?.email ?? ""} maxLength={160} autoComplete="email" />
            </Field>
          </div>
        </section>

        {/* Delivery */}
        <section className="card">
          <div className="card-header"><h2 className="card-title">2. Delivery address</h2></div>
          <div className="card-body stack">
            {addresses.length > 0 ? (
              <div className="stack gap-2">
                {addresses.map((address) => (
                  <label key={address.id} className={cn("check-row", addressId === address.id && "check-row-active")}>
                    <input
                      type="radio"
                      name="addressId"
                      value={address.id}
                      className="radio mt-0.5"
                      checked={addressId === address.id}
                      onChange={() => {
                        setAddressId(address.id);
                        if (address.districtId) changeDistrict(address.districtId);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {address.label ?? address.fullName}
                        {address.isDefault ? <span className="badge-gray ml-2">Default</span> : null}
                      </span>
                      <span className="block text-xs text-brand-500">
                        {address.addressLine1}
                        {address.area ? `, ${address.area}` : ""}, {address.districtName} • {address.phone}
                      </span>
                    </span>
                  </label>
                ))}
                <label className={cn("check-row", useNewAddress && "check-row-active")}>
                  <input
                    type="radio"
                    name="addressId"
                    value=""
                    className="radio mt-0.5"
                    checked={useNewAddress}
                    onChange={() => setAddressId("")}
                  />
                  <span className="font-semibold">Use a new address</span>
                </label>
              </div>
            ) : (
              <input type="hidden" name="addressId" value="" />
            )}

            <div className={cn("grid-form-2", !useNewAddress && addresses.length > 0 && "hidden")}>
              <Field label="District" htmlFor="districtId" required error={fields.districtId} hint="Your delivery charge depends on this.">
                <select
                  id="districtId"
                  name="districtId"
                  className="select"
                  value={districtId}
                  onChange={(event) => changeDistrict(event.target.value)}
                  required
                >
                  <option value="">Select your district</option>
                  {Object.entries(grouped).map(([division, items]) => (
                    <optgroup key={division} label={division}>
                      {items.map((district) => (
                        <option key={district.id} value={district.id}>
                          {district.name}
                          {district.isFreeDelivery ? " — free delivery" : ` — ${formatMoney(district.deliveryCharge)}`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Area / thana" htmlFor="area" error={fields.area}>
                <input id="area" name="area" className="input" defaultValue={defaultAddress?.area ?? ""} maxLength={120} />
              </Field>
              <Field label="City / town" htmlFor="city" error={fields.city}>
                <input id="city" name="city" className="input" defaultValue={defaultAddress?.city ?? ""} maxLength={80} />
              </Field>
              <Field label="Postal code" htmlFor="postalCode" error={fields.postalCode}>
                <input id="postalCode" name="postalCode" className="input" defaultValue={defaultAddress?.postalCode ?? ""} maxLength={12} inputMode="numeric" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Full address" htmlFor="addressLine1" required error={fields.addressLine1} hint="House, road, landmark — as specific as possible.">
                  <textarea id="addressLine1" name="addressLine1" className="textarea" defaultValue={defaultAddress?.addressLine1 ?? ""} required maxLength={300} rows={3} />
                </Field>
              </div>
              <input type="hidden" name="addressLine2" value="" />
              {user ? (
                <label className="check-row sm:col-span-2">
                  <input type="checkbox" name="saveAddress" value="true" className="checkbox mt-0.5" defaultChecked />
                  <span>Save this address to my account</span>
                </label>
              ) : null}
            </div>

            {/* When a saved address is selected these carry its values through. */}
            {!useNewAddress && defaultAddress ? (
              <>
                <input type="hidden" name="districtId" value={districtId} />
                <input type="hidden" name="addressLine1" value={addresses.find((a) => a.id === addressId)?.addressLine1 ?? ""} />
              </>
            ) : null}
          </div>
        </section>

        {/* Payment */}
        <section className="card">
          <div className="card-header"><h2 className="card-title">3. Payment method</h2></div>
          <div className="card-body stack gap-2">
            {paymentOptions.map((option) => (
              <label key={option.value} className={cn("check-row", paymentMethod === option.value && "check-row-active")}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.value}
                  className="radio mt-0.5"
                  checked={paymentMethod === option.value}
                  onChange={() => setPaymentMethod(option.value)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-xs text-brand-500">{option.description}</span>
                </span>
              </label>
            ))}

            {paymentMethod === "BKASH" ? (
              <div className="panel stack">
                {bkashNumber ? (
                  <p className="text-sm">
                    Send <strong>{formatMoney(cart.quote.grandTotal)}</strong> to <strong className="mono">{bkashNumber}</strong>, then enter both details below.
                  </p>
                ) : null}
                <Field
                  label="bKash number you paid from"
                  htmlFor="bkashSenderNumber"
                  required
                  error={fields.bkashSenderNumber}
                  hint="The wallet the money was sent from, so we can match your payment."
                >
                  <input
                    id="bkashSenderNumber"
                    name="bkashSenderNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="input"
                    placeholder="01XXXXXXXXX"
                    maxLength={14}
                  />
                </Field>
                <Field label="bKash transaction ID" htmlFor="bkashTransactionId" required error={fields.bkashTransactionId}>
                  <input id="bkashTransactionId" name="bkashTransactionId" className="input uppercase" maxLength={60} />
                </Field>
                <p className="form-hint">Our team verifies every transaction before confirming the order.</p>
              </div>
            ) : null}

            {requirePhoneVerification ? (
              <PhoneVerification phone={phone} verified={phoneVerified} onVerified={() => setVerifiedPhone(phone)} />
            ) : null}

            <Field label="Order note (optional)" htmlFor="customerNote">
              <textarea id="customerNote" name="customerNote" className="textarea" rows={2} maxLength={1000} placeholder="Delivery instructions, preferred time…" />
            </Field>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="stack lg:sticky lg:top-24 lg:self-start">
        <div className="card">
          <div className="card-header"><h2 className="card-title">Order summary</h2></div>
          <div className="card-body">
            <ul className="mb-3 space-y-2">
              {cart.lines.map((line) => (
                <li key={line.itemId} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="clamp-2 block font-medium">{line.name}</span>
                    {line.variantName ? <span className="block text-xs text-brand-500">{line.variantName}</span> : null}
                    <span className="block text-xs text-brand-500">Qty {line.quantity}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(line.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-line pt-2">
              <div className="summary-row"><span>Subtotal</span><span>{formatMoney(cart.quote.subtotal)}</span></div>
              {cart.quote.flashDiscount > 0 ? (
                <div className="summary-row text-success-700"><span>Flash sale</span><span>−{formatMoney(cart.quote.flashDiscount)}</span></div>
              ) : null}
              {cart.quote.offerDiscount > 0 ? (
                <div className="summary-row text-success-700"><span>Offer</span><span>−{formatMoney(cart.quote.offerDiscount)}</span></div>
              ) : null}
              {cart.quote.couponDiscount > 0 ? (
                <div className="summary-row text-success-700">
                  <span>Coupon {cart.quote.coupon?.code}</span><span>−{formatMoney(cart.quote.couponDiscount)}</span>
                </div>
              ) : null}
              <div className="summary-row">
                <span>Delivery{cart.quote.shipping.districtName ? ` — ${cart.quote.shipping.districtName}` : ""}</span>
                <span>{cart.quote.shipping.total === 0 ? "Free" : formatMoney(cart.quote.shipping.total)}</span>
              </div>
              {cart.quote.shipping.freeReason ? (
                <p className="text-xs font-medium text-success-700">{cart.quote.shipping.freeReason}</p>
              ) : null}
              <div className="summary-row-total"><span>Total payable</span><span>{formatMoney(cart.quote.grandTotal)}</span></div>
            </div>

            {cart.quote.couponError ? <p className="form-error mt-2">{cart.quote.couponError}</p> : null}

            <button
              type="submit"
              className="btn-primary btn-block btn-lg mt-4"
              disabled={
                pending ||
                cart.isEmpty ||
                cart.hasUnavailable ||
                (!user && !isGuestAllowed) ||
                !districtId ||
                (requirePhoneVerification && !phoneVerified)
              }
            >
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              {pending ? "Placing order…" : `Place order · ${formatMoney(cart.quote.grandTotal)}`}
            </button>

            {!districtId ? <p className="form-hint mt-2">Select your district to see the exact delivery charge.</p> : null}
            {requirePhoneVerification && !phoneVerified ? (
              <p className="form-hint mt-2">Verify your mobile number to place the order.</p>
            ) : null}
            <p className="form-hint mt-2">
              By placing this order you agree to our <Link href="/terms" className="link">terms</Link> and{" "}
              <Link href="/refund-policy" className="link">refund policy</Link>.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
