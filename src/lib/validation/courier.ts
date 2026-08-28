import { z } from "zod";

import { idSchema, optionalIdSchema, optionalText } from "./common";

/** Shipment statuses a person is allowed to set by hand. */
export const MANUAL_SHIPMENT_STATUSES = [
  "CREATED", "PICKUP_PENDING", "PICKED", "IN_TRANSIT", "AT_HUB", "AT_DESTINATION",
  "OUT_FOR_DELIVERY", "DELIVERED", "HOLD", "FAILED", "RETURNED", "CANCELLED",
] as const;

export const manualShipmentSchema = z.object({
  orderId: idSchema,
  courierId: optionalIdSchema,
  courierName: optionalText(80),
  trackingNumber: z.string().trim().min(3, "Enter the tracking number the courier gave you.").max(80),
  courierCharge: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  note: optionalText(300),
});

export const trackingStepSchema = z.object({
  shipmentId: idSchema,
  status: z.enum(MANUAL_SHIPMENT_STATUSES),
  description: optionalText(200),
  location: optionalText(120),
});

export const settlementSchema = z.object({
  shipmentId: idSchema,
  /** What the courier collected from the customer. */
  collectedAmount: z.coerce.number().min(0).max(10_000_000),
  /** What they charged us to carry it. */
  courierCharge: z.coerce.number().min(0).max(1_000_000),
  /** What actually landed in our account. */
  settledAmount: z.coerce.number().min(0).max(10_000_000),
  note: optionalText(300),
});

export type ManualShipmentInput = z.infer<typeof manualShipmentSchema>;
export type SettlementInput = z.infer<typeof settlementSchema>;
