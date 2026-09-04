"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { removeCartItemAction, updateCartItemAction } from "@/app/actions/cart";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { OverlayPortal } from "./overlay-portal";

type DrawerLine = {
  itemId: string;
  name: string;
  slug: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  lineTotal: number;
  availableStock: number;
  isAvailable: boolean;
  unavailableReason: string | null;
};

type DrawerCart = {
  isEmpty: boolean;
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  total: number;
  hasUnavailable: boolean;
  lines: DrawerLine[];
};

/** Opens the drawer from anywhere — the add-to-cart button uses it too. */
export const CART_DRAWER_EVENT = "trust-mart:open-cart";

export function openCartDrawer(): void {
  window.dispatchEvent(new CustomEvent(CART_DRAWER_EVENT));
}

/**
 * Slide-over mini cart.
 *
 * The contents are fetched when it opens rather than rendered into the header
 * on every page: pricing a full cart on every request would slow the whole
 * site down to serve the few seconds someone looks at it. It also means the
 * drawer is always current after an add, with no cache to invalidate.
 */
export function CartDrawer({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<DrawerCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const toast = useToast();

  const count = cart ? cart.itemCount : initialCount;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: DrawerCart;
      };
      if (payload.ok && payload.data) setCart(payload.data);
    } catch {
      // A failed fetch leaves whatever was last shown; the full cart page is
      // one tap away and is the reliable view.
    } finally {
      setLoading(false);
    }
  }, []);

  // Opening from elsewhere (the add-to-cart button) goes through a window
  // event rather than a shared store: the trigger and the button are rendered
  // by different server components and never share a React tree.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
      void load();
    }
    window.addEventListener(CART_DRAWER_EVENT, onOpen);
    return () => window.removeEventListener(CART_DRAWER_EVENT, onOpen);
  }, [load]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);

    // Lock the page behind the drawer, and put the width back so the layout
    // does not jump as the scrollbar disappears.
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load();
  }

  function setQuantity(itemId: string, quantity: number) {
    const formData = new FormData();
    formData.append("itemId", itemId);
    formData.append("quantity", String(quantity));

    startTransition(async () => {
      const result =
        quantity <= 0
          ? await removeCartItemAction(idleState, formData)
          : await updateCartItemAction(idleState, formData);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      await load();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn-icon relative"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"
        }
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          aria-hidden="true"
        >
          <path
            d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="20" r="1.2" />
          <circle cx="18" cy="20" r="1.2" />
        </svg>
        {count > 0 ? (
          <span className="cart-badge">{count > 99 ? "99+" : count}</span>
        ) : null}
      </button>

      {open ? (
        <OverlayPortal>
          <div
            className="drawer-root"
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
          >
            <button
              type="button"
              className="drawer-scrim"
              onClick={() => setOpen(false)}
              aria-label="Close cart"
            />

            <div className="drawer-panel" ref={panelRef}>
              <div className="drawer-header">
                <div>
                  <h2 className="text-base font-bold">Your cart</h2>
                  <p className="muted-xs">
                    {count === 0
                      ? "Nothing in it yet"
                      : `${count} item${count === 1 ? "" : "s"}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close cart"
                  ref={closeRef}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className="drawer-body">
                {loading && !cart ? (
                  <div className="space-y-3 p-4">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="skeleton h-20 w-full" />
                    ))}
                  </div>
                ) : !cart || cart.isEmpty ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-brand-800">
                      Your cart is empty
                    </p>
                    <p className="muted-xs">
                      Browse the shop and add something you like.
                    </p>
                    <Link
                      href="/shop"
                      className="btn-primary btn-sm"
                      onClick={() => setOpen(false)}
                    >
                      Start shopping
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {cart.lines.map((line) => (
                      <li key={line.itemId} className="drawer-line">
                        <Link
                          href={`/product/${line.slug}`}
                          className="shrink-0"
                          onClick={() => setOpen(false)}
                          aria-hidden="true"
                          tabIndex={-1}
                        >
                          {line.imageUrl ? (
                            <Image
                              src={line.imageUrl}
                              alt=""
                              width={64}
                              height={64}
                              className="h-16 w-16 rounded-[var(--radius-tm)] border border-line object-cover"
                            />
                          ) : (
                            <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-tm)] border border-line bg-surface-muted text-xs text-brand-400">
                              No image
                            </span>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/product/${line.slug}`}
                            className="clamp-2 text-sm font-semibold hover:underline"
                            onClick={() => setOpen(false)}
                          >
                            {line.name}
                          </Link>
                          {line.variantName ? (
                            <p className="muted-xs">{line.variantName}</p>
                          ) : null}

                          <p className="mt-0.5 text-sm font-bold">
                            {formatMoney(line.unitPrice)}
                            {line.listPrice > line.unitPrice ? (
                              <span className="price-old ml-1.5">
                                {formatMoney(line.listPrice)}
                              </span>
                            ) : null}
                          </p>

                          {!line.isAvailable ? (
                            <p className="mt-1 text-xs font-medium text-danger-600">
                              {line.unavailableReason ?? "No longer available"}
                            </p>
                          ) : null}

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="qty-control">
                              <button
                                type="button"
                                className="qty-btn"
                                onClick={() =>
                                  setQuantity(line.itemId, line.quantity - 1)
                                }
                                disabled={pending || line.quantity <= 1}
                                aria-label={`Reduce ${line.name} quantity`}
                              >
                                −
                              </button>
                              <span className="qty-value">{line.quantity}</span>
                              <button
                                type="button"
                                className="qty-btn"
                                onClick={() =>
                                  setQuantity(line.itemId, line.quantity + 1)
                                }
                                disabled={
                                  pending ||
                                  line.quantity >= line.availableStock
                                }
                                aria-label={`Increase ${line.name} quantity`}
                              >
                                +
                              </button>
                            </div>

                            <span className="text-sm font-bold tabular-nums">
                              {formatMoney(line.lineTotal)}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="btn-link mt-1 text-xs"
                            onClick={() => setQuantity(line.itemId, 0)}
                            disabled={pending}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {cart && !cart.isEmpty ? (
                <div className="drawer-footer">
                  {cart.hasUnavailable ? (
                    <p className="alert-warning mb-2 text-xs" role="status">
                      Some items are unavailable. Remove them before checking
                      out.
                    </p>
                  ) : null}

                  <div className="space-y-1 text-sm">
                    <div className="row-between">
                      <span className="muted">Subtotal</span>
                      <span className="tabular-nums">
                        {formatMoney(cart.subtotal)}
                      </span>
                    </div>
                    {cart.discountTotal > 0 ? (
                      <div className="row-between text-success-700">
                        <span>Discounts</span>
                        <span className="tabular-nums">
                          −{formatMoney(cart.discountTotal)}
                        </span>
                      </div>
                    ) : null}
                    <div className="row-between border-t border-line pt-1 text-base font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatMoney(cart.total)}
                      </span>
                    </div>
                    <p className="muted-xs">
                      Delivery is added at checkout, once you pick your
                      district.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Link
                      href="/cart"
                      className="btn-secondary btn-block"
                      onClick={() => setOpen(false)}
                    >
                      View cart
                    </Link>
                    <Link
                      href="/checkout"
                      className="btn-primary btn-block"
                      onClick={() => setOpen(false)}
                    >
                      Checkout
                    </Link>
                  </div>
                  <Link
                    href="/shop"
                    className="btn-ghost btn-sm btn-block mt-2"
                    onClick={() => setOpen(false)}
                  >
                    Continue shopping
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}
