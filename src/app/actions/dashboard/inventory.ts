"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { adjustStock, isAdjustmentReason, ADJUSTMENT_REASONS } from "@/lib/services/inventory";
import { cancelIncomingStock, createIncomingStock, receiveIncomingStock } from "@/lib/services/incoming-stock";
import { toMinor } from "@/lib/money";
import {
  incomingStockSchema,
  stockAdjustmentSchema,
  stockThresholdSchema,
  warehouseSchema,
} from "@/lib/validation/inventory";
import { formDataToObject } from "@/lib/validation/common";

function refreshInventory() {
  revalidatePath("/dashboard/inventory", "layout");
  revalidatePath("/dashboard/products");
}

export async function adjustStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST);
    const input = stockAdjustmentSchema.parse(formDataToObject(formData));

    if (!isAdjustmentReason(input.reason)) throw errors.validation("Pick a reason for this adjustment.");

    const result = await adjustStock({
      productId: input.productId,
      variantId: input.variantId || null,
      reason: input.reason,
      quantity: input.quantity,
      warehouseId: input.warehouseId || null,
      toWarehouseId: input.toWarehouseId || null,
      note: input.note || null,
      unitCost: input.unitCost != null ? toMinor(input.unitCost) : null,
      actor: { id: user.id, name: user.name },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: "product",
      entityId: input.variantId || input.productId,
      summary: `${ADJUSTMENT_REASONS[input.reason].label}: ${input.quantity} → ${result.quantityAfter} available`,
      severity: "WARNING",
    });

    refreshInventory();
    return actionSuccess(`Stock adjusted. ${result.quantityAfter} now available.`);
  } catch (error) {
    return actionFailure(error, "adjustStock");
  }
}

/** Per-product alert levels, edited straight from the stock table. */
export async function saveStockThresholdsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const input = stockThresholdSchema.parse(formDataToObject(formData));

    if (input.variantId) {
      await prisma.productVariant.update({
        where: { id: input.variantId },
        data: { lowStockThreshold: input.lowStockThreshold, reorderLevel: input.reorderLevel },
      });
    } else {
      await prisma.product.update({
        where: { id: input.productId },
        data: { lowStockThreshold: input.lowStockThreshold, reorderLevel: input.reorderLevel },
      });
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: "product",
      entityId: input.variantId || input.productId,
      summary: `Alert at ${input.lowStockThreshold}, reorder at ${input.reorderLevel}`,
    });

    refreshInventory();
    return actionSuccess("Stock alert levels saved.");
  } catch (error) {
    return actionFailure(error, "saveStockThresholds");
  }
}

export async function saveWarehouseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.WAREHOUSE_MANAGE);
    const input = warehouseSchema.parse(formDataToObject(formData));

    const data = {
      name: input.name,
      code: input.code.toLowerCase(),
      address: input.address || null,
      city: input.city || null,
      phone: input.phone || null,
      isDefault: input.isDefault,
      isActive: input.isActive,
      position: input.position,
      note: input.note || null,
    };

    const warehouse = input.id
      ? await prisma.warehouse.update({ where: { id: input.id }, data })
      : await prisma.warehouse.create({ data });

    // Exactly one default, or "where does this land?" has no answer.
    if (input.isDefault) {
      await prisma.warehouse.updateMany({
        where: { id: { not: warehouse.id } },
        data: { isDefault: false },
      });
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.WAREHOUSE_CHANGED,
      entityType: "warehouse",
      entityId: warehouse.id,
      summary: `Warehouse ${warehouse.name} ${input.id ? "updated" : "created"}`,
    });

    refreshInventory();
    return actionSuccess(input.id ? "Warehouse updated." : "Warehouse created.");
  } catch (error) {
    return actionFailure(error, "saveWarehouse");
  }
}

export async function createIncomingStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
    const input = incomingStockSchema.parse({
      ...formDataToObject(formData),
      productIds: formData.getAll("productIds").map(String),
      variantIds: formData.getAll("variantIds").map(String),
      quantities: formData.getAll("quantities").map(String),
      unitCosts: formData.getAll("unitCosts").map(String),
    });

    const lines = input.productIds
      .map((productId, index) => ({
        productId,
        variantId: input.variantIds[index] || null,
        quantity: Number(input.quantities[index] ?? 0) || 0,
        unitCost: toMinor(Number(input.unitCosts[index] ?? 0) || 0),
      }))
      .filter((line) => line.productId && line.quantity > 0);

    const id = await createIncomingStock({
      reference: input.reference,
      supplierName: input.supplierName,
      supplierPhone: input.supplierPhone || null,
      warehouseId: input.warehouseId || null,
      expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
      shippingCost: toMinor(input.shippingCost ?? 0),
      note: input.note || null,
      lines,
      actorId: user.id,
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: "incoming",
      entityId: id,
      summary: `Incoming ${input.reference} from ${input.supplierName}, ${lines.length} line(s)`,
    });

    refreshInventory();
    return actionSuccess("Incoming shipment recorded.");
  } catch (error) {
    return actionFailure(error, "createIncomingStock");
  }
}

export async function receiveIncomingStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
    const incomingId = String(formData.get("incomingId") ?? "");
    if (!incomingId) throw errors.validation("Which shipment are you receiving?");

    const itemIds = formData.getAll("itemIds").map(String);
    const received = itemIds.map((itemId, index) => ({
      itemId,
      quantity: Number(formData.getAll("receivedQuantities")[index] ?? 0) || 0,
    }));

    await receiveIncomingStock(incomingId, received, { id: user.id, name: user.name });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.STOCK_RECEIVED,
      entityType: "incoming",
      entityId: incomingId,
      summary: "Incoming stock received",
      severity: "WARNING",
    });

    refreshInventory();
    return actionSuccess("Stock received and added to inventory.");
  } catch (error) {
    return actionFailure(error, "receiveIncomingStock");
  }
}

export async function cancelIncomingStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
    const incomingId = String(formData.get("incomingId") ?? "");
    if (!incomingId) throw errors.validation("Which shipment are you cancelling?");

    await cancelIncomingStock(incomingId);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: "incoming",
      entityId: incomingId,
      summary: "Incoming stock cancelled",
      severity: "WARNING",
    });

    refreshInventory();
    return actionSuccess("Incoming shipment cancelled.");
  } catch (error) {
    return actionFailure(error, "cancelIncomingStock");
  }
}
