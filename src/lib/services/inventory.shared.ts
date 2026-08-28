import type { InventoryMovementType } from "@/generated/prisma/enums";

/**
 * Adjustment vocabulary, kept free of server-only imports.
 *
 * The forms, the validation schema and the service all have to agree on this
 * list, and two of those three can be reached from the browser bundle — so it
 * lives apart from `inventory.ts`, which is `server-only`.
 *
 * `delta` fixes the direction so a "damaged" line cannot secretly add stock.
 * Only the two corrections accept either sign, because that is what a
 * correction is for.
 */
export const ADJUSTMENT_REASONS = {
  RECEIVED: { label: "Stock received", type: "RECEIVED", delta: "increase" },
  DAMAGED: { label: "Damaged", type: "DAMAGED", delta: "decrease" },
  LOST: { label: "Lost", type: "LOST", delta: "decrease" },
  RETURNED: { label: "Returned to stock", type: "RETURN", delta: "increase" },
  EXPIRED: { label: "Expired", type: "EXPIRED", delta: "decrease" },
  MANUAL_CORRECTION: { label: "Manual correction", type: "ADJUSTMENT", delta: "either" },
  COUNT_CORRECTION: { label: "Inventory count correction", type: "COUNT_CORRECTION", delta: "either" },
  TRANSFER: { label: "Warehouse transfer", type: "TRANSFER_OUT", delta: "either" },
} as const satisfies Record<
  string,
  { label: string; type: InventoryMovementType; delta: "increase" | "decrease" | "either" }
>;

export type AdjustmentReason = keyof typeof ADJUSTMENT_REASONS;

export const ADJUSTMENT_REASON_KEYS = Object.keys(ADJUSTMENT_REASONS) as AdjustmentReason[];

export function isAdjustmentReason(value: string): value is AdjustmentReason {
  return Object.hasOwn(ADJUSTMENT_REASONS, value);
}

/** Human labels for the movement ledger. */
export const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  PURCHASE: "Purchase",
  SALE: "Sale",
  RETURN: "Return",
  ADJUSTMENT: "Manual correction",
  RESERVATION: "Reserved",
  RELEASE: "Released",
  CANCELLATION: "Order cancelled",
  RECEIVED: "Stock received",
  DAMAGED: "Damaged",
  LOST: "Lost",
  EXPIRED: "Expired",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  COUNT_CORRECTION: "Count correction",
};
