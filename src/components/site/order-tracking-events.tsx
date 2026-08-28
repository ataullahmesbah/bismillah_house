"use client";

import { useEffect, useRef } from "react";

import { trackPurchase } from "./analytics";

/** Fires the analytics `purchase` event exactly once per confirmation view. */
export function OrderPlacedTracking({
  orderNumber,
  value,
  items,
}: {
  orderNumber: string;
  value: number;
  items: Array<{ item_id: string; item_name: string; price: number; quantity: number }>;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    const key = `tm_purchase_${orderNumber}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable — still send once per mount.
    }
    sent.current = true;
    trackPurchase(orderNumber, value, items);
  }, [orderNumber, value, items]);

  return null;
}
