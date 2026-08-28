import { z } from "zod";

import { booleanSchema, idSchema, optionalIdSchema, optionalText } from "./common";
import { ADJUSTMENT_REASON_KEYS } from "@/lib/services/inventory.shared";

/** Everything the inventory screens accept from a browser. */

export const stockAdjustmentSchema = z.object({
  productId: idSchema,
  variantId: optionalIdSchema,
  reason: z.enum(ADJUSTMENT_REASON_KEYS as [string, ...string[]]),
  /**
   * Signed on purpose. A correction may go either way, and the service refuses
   * a sign the chosen reason does not allow rather than silently flipping it.
   */
  quantity: z.coerce
    .number()
    .int("Enter a whole number of units.")
    .min(-1_000_000)
    .max(1_000_000)
    .refine((value) => value !== 0, "Enter a quantity to adjust by."),
  warehouseId: optionalIdSchema,
  toWarehouseId: optionalIdSchema,
  unitCost: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  note: optionalText(300),
});

export const stockThresholdSchema = z.object({
  productId: idSchema,
  variantId: optionalIdSchema,
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
  reorderLevel: z.coerce.number().int().min(0).max(100_000),
});

export const warehouseSchema = z.object({
  id: optionalIdSchema,
  name: z.string().trim().min(2, "Give the warehouse a name.").max(120),
  code: z
    .string()
    .trim()
    .min(2, "Give the warehouse a short code.")
    .max(24)
    .regex(/^[a-zA-Z0-9-]+$/, "Use letters, numbers and hyphens only."),
  address: optionalText(300),
  city: optionalText(80),
  phone: optionalText(30),
  isDefault: booleanSchema.default(false),
  isActive: booleanSchema.default(true),
  position: z.coerce.number().int().min(0).max(999).default(0),
  note: optionalText(300),
});

export const incomingStockSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(2, "Give this shipment a reference, e.g. the supplier invoice number.")
    .max(60),
  supplierName: z.string().trim().min(2, "Who is it coming from?").max(160),
  supplierPhone: optionalText(30),
  warehouseId: optionalIdSchema,
  expectedAt: optionalText(40),
  shippingCost: z.coerce.number().min(0).max(10_000_000).optional().default(0),
  note: optionalText(500),
  productIds: z.array(z.string()),
  variantIds: z.array(z.string()),
  quantities: z.array(z.string()),
  unitCosts: z.array(z.string()),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type WarehouseInput = z.infer<typeof warehouseSchema>;
export type IncomingStockInput = z.infer<typeof incomingStockSchema>;
