"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addToCartAction } from "@/app/actions/cart";
import { useToast } from "@/components/ui/toast";
import { openCartDrawer } from "./cart-drawer";
import { idleState } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Quantity stepper used on the product page and in the cart. */
export function QuantityStepper({
  value,
  onChange,
  max = 999,
  min = 1,
  name,
}: {
  value: number;
  onChange: (next: number) => void;
  max?: number;
  min?: number;
  name?: string;
}) {
  return (
    <div className="qty-control">
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="qty-value" aria-live="polite">{value}</span>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}

export function AddToCartForm({
  productId,
  variantId,
  maxQuantity,
  disabled,
  disabledReason,
  showQuantity = true,
  buttonLabel = "Add to cart",
  buttonClass = "btn-primary btn-block btn-lg",
  showBuyNow = false,
  onAdded,
}: {
  productId: string;
  variantId?: string | null;
  maxQuantity: number;
  disabled?: boolean;
  disabledReason?: string;
  showQuantity?: boolean;
  buttonLabel?: string;
  buttonClass?: string;
  /** Adds a "Buy now" button that goes straight to checkout. */
  showBuyNow?: boolean;
  onAdded?: () => void;
}) {
  const [state, formAction, pending] = useActionState(addToCartAction, idleState);
  const [requestedQuantity, setQuantity] = useState(1);
  const [buying, startBuying] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // Clamp during render so a variant change with less stock can never submit a
  // quantity the server would reject.
  const quantity = Math.min(requestedQuantity, Math.max(1, maxQuantity));

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      // Show what is in the cart rather than only saying something went in —
      // the shopper can see the running total and get to checkout in one tap.
      openCartDrawer();
      onAdded?.();
    }
  }, [state, router, onAdded]);

  const unavailable = Boolean(disabled) || maxQuantity <= 0;
  const busy = pending || buying;

  /**
   * Buy now is the same add-to-cart call, followed by a jump to checkout —
   * so a shopper in a hurry never has to visit the cart, and the price is
   * still recalculated on the server exactly as it would be otherwise.
   */
  function buyNow() {
    if (unavailable) return;

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("variantId", variantId ?? "");
    formData.append("quantity", String(quantity));

    startBuying(async () => {
      const result = await addToCartAction(idleState, formData);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      router.push("/checkout");
    });
  }

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId ?? ""} />
      <input type="hidden" name="quantity" value={quantity} />

      <div className={cn("flex gap-3", !showQuantity && "flex-col")}>
        {showQuantity ? (
          <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, maxQuantity)} />
        ) : null}
        <button type="submit" className={buttonClass} disabled={unavailable || busy}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Adding…" : buttonLabel}
        </button>
      </div>

      {showBuyNow ? (
        <button
          type="button"
          className="btn-accent btn-block btn-lg"
          onClick={buyNow}
          disabled={unavailable || busy}
        >
          {buying ? <span className="spinner" aria-hidden="true" /> : null}
          {buying ? "Taking you to checkout…" : "Buy now"}
        </button>
      ) : null}

      {disabled && disabledReason ? <p className="form-hint">{disabledReason}</p> : null}
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      {state.status === "success" ? (
        <p role="status" className="text-xs font-semibold text-success-700">
          Added to your cart.
        </p>
      ) : null}
    </form>
  );
}

/** Compact "quick add" used on product cards in listings. */
export function QuickAddButton({ productId, name, inStock, hasVariants, slug }: {
  productId: string;
  name: string;
  inStock: boolean;
  hasVariants: boolean;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState(addToCartAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      openCartDrawer();
    }
  }, [state, router]);

  if (hasVariants) {
    return (
      <a href={`/product/${slug}`} className="btn-secondary btn-sm btn-block">
        Choose options<span className="sr-only"> for {name}</span>
      </a>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value="" />
      <input type="hidden" name="quantity" value="1" />
      {/*
        * A grid of eight buttons all announced as "Add to cart" tells a screen
        * reader user nothing about which one they are on. The product name is
        * appended rather than replacing the label so the accessible name still
        * contains the visible text (WCAG 2.5.3, Label in Name).
        */}
      <button type="submit" className="btn-secondary btn-sm btn-block" disabled={!inStock || pending}>
        {!inStock ? "Out of stock" : pending ? "Adding…" : "Add to cart"}
        <span className="sr-only"> — {name}</span>
      </button>
    </form>
  );
}
