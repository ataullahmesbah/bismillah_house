"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { removeCartItemAction, updateCartItemAction } from "@/app/actions/cart";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { CartLineView } from "@/lib/services/cart";

export function CartLineRow({ line }: { line: CartLineView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setQuantity(quantity: number) {
    const formData = new FormData();
    formData.set("itemId", line.itemId);
    formData.set("quantity", String(quantity));
    startTransition(async () => {
      await updateCartItemAction(idleState, formData);
      router.refresh();
    });
  }

  function remove() {
    const formData = new FormData();
    formData.set("itemId", line.itemId);
    startTransition(async () => {
      await removeCartItemAction(idleState, formData);
      router.refresh();
    });
  }

  return (
    <tr className={pending ? "opacity-60" : undefined}>
      <td>
        <div className="flex items-start gap-3">
          <Link href={`/product/${line.slug}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-tm)] border border-line bg-white">
            {line.imageUrl ? (
              <Image src={line.imageUrl} alt={line.name} fill sizes="64px" className="object-contain" />
            ) : null}
          </Link>
          <div className="min-w-0">
            <Link href={`/product/${line.slug}`} className="clamp-2 text-sm font-semibold hover:underline">
              {line.name}
            </Link>
            {line.variantName ? <p className="muted-xs">{line.variantName}</p> : null}
            {line.badge ? <span className="badge-red mt-1">{line.badge}</span> : null}
            {line.shippingMode === "FREE" ? (
              <p className="text-xs font-semibold text-success-700">Free delivery</p>
            ) : null}
            {!line.isAvailable ? <p className="form-error mt-1">{line.unavailableReason}</p> : null}
            <button type="button" onClick={remove} className="btn-link mt-1 text-xs text-danger-600" disabled={pending}>
              Remove
            </button>
          </div>
        </div>
      </td>
      <td className="td-num">
        {formatMoney(line.unitPrice)}
        {line.listPrice > line.unitPrice ? (
          <span className="ml-1.5 block text-xs font-normal text-brand-400 line-through">
            {formatMoney(line.listPrice)}
          </span>
        ) : null}
      </td>
      <td>
        <div className="qty-control">
          <button
            type="button"
            className="qty-btn"
            onClick={() => setQuantity(line.quantity - 1)}
            disabled={pending || line.quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="qty-value">{line.quantity}</span>
          <button
            type="button"
            className="qty-btn"
            onClick={() => setQuantity(line.quantity + 1)}
            disabled={pending || line.quantity >= line.availableStock}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </td>
      <td className="td-num font-semibold">
        {formatMoney(line.lineTotal)}
        {line.couponDiscount > 0 ? (
          <span className="block text-xs font-normal text-success-700">
            −{formatMoney(line.couponDiscount)} coupon
          </span>
        ) : null}
      </td>
    </tr>
  );
}

/** Coupon box on the cart page — the code is validated on the server. */
export function CouponBox({
  appliedCode,
  attemptedCode,
  error,
  discount,
}: {
  /** Set only when the server accepted the coupon. */
  appliedCode: string | null;
  /** What the shopper typed, kept in the box so a rejected code can be edited. */
  attemptedCode?: string | null;
  error: string | null;
  discount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // Announce the server's verdict once per code, rather than on every render.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    const key = `${appliedCode ?? attemptedCode ?? ""}:${error ?? ""}`;
    if (!attemptedCode && !appliedCode) return;
    if (announced.current === key) return;
    announced.current = key;

    if (error) toast.error("Coupon not applied", error);
    else if (appliedCode) toast.success(`Coupon ${appliedCode} applied`, `You saved ${formatMoney(discount)}.`);
  }, [appliedCode, attemptedCode, error, discount, toast]);

  function apply(formData: FormData) {
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    startTransition(() => {
      const url = new URL(window.location.href);
      if (code) url.searchParams.set("coupon", code);
      else url.searchParams.delete("coupon");
      router.push(`${url.pathname}${url.search}`);
      router.refresh();
    });
  }

  function clear() {
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("coupon");
      router.push(`${url.pathname}${url.search}`);
      router.refresh();
    });
  }

  if (appliedCode && !error) {
    return (
      <div className="alert-success">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Coupon {appliedCode} applied</p>
          <p className="text-xs">You saved {formatMoney(discount)}.</p>
        </div>
        <button type="button" onClick={clear} className="btn-link text-xs" disabled={pending}>Remove</button>
      </div>
    );
  }

  return (
    <form action={apply} className="field">
      <label className="label" htmlFor="coupon-code">Have a coupon?</label>
      <div className="input-affix">
        <input
          id="coupon-code"
          name="code"
          className="input uppercase"
          placeholder="Enter code"
          defaultValue={attemptedCode ?? ""}
          maxLength={40}
          aria-invalid={Boolean(error)}
        />
        <button type="submit" className="input-affix-text font-semibold hover:bg-brand-100" disabled={pending}>
          Apply
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
