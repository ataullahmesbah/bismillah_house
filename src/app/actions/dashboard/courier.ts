"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { applyTracking, dispatchToCourier, recordSettlement, syncShipment, buildTrackingUrl } from "@/lib/services/courier";
import { toMinor } from "@/lib/money";
import { manualShipmentSchema, settlementSchema, trackingStepSchema } from "@/lib/validation/courier";
import { formDataToObject } from "@/lib/validation/common";

function refreshOrder(orderId: string) {
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/courier", "layout");
}

/** Creates the parcel at the courier from the order screen. */
export async function dispatchOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COURIER_DISPATCH);
    const orderId = String(formData.get("orderId") ?? "");
    const courierId = String(formData.get("courierId") ?? "");
    const note = String(formData.get("note") ?? "").trim() || null;

    if (!orderId || !courierId) throw errors.validation("Pick a courier to send this order to.");

    const result = await dispatchToCourier(
      orderId,
      courierId,
      { id: user.id, name: user.name, role: user.role },
      { note },
    );

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.COURIER_DISPATCHED,
      entityType: "order",
      entityId: orderId,
      summary: `Parcel created, tracking ${result.trackingNumber}`,
      severity: "WARNING",
    });

    refreshOrder(orderId);
    return actionSuccess(`Parcel created. Tracking number ${result.trackingNumber}.`);
  } catch (error) {
    return actionFailure(error, "dispatchOrder");
  }
}

/**
 * Records a parcel someone created in the courier's own dashboard.
 *
 * The fallback for a courier with no API, and for the day an API is down and
 * the parcels still have to go out.
 */
export async function recordManualShipmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COURIER_DISPATCH);
    const input = manualShipmentSchema.parse(formDataToObject(formData));

    const [order, courier] = await Promise.all([
      prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true, orderNumber: true } }),
      input.courierId
        ? prisma.courier.findUnique({
            where: { id: input.courierId },
            select: { id: true, name: true, trackingUrlTemplate: true, defaultCharge: true },
          })
        : Promise.resolve(null),
    ]);
    if (!order) throw errors.notFound("Order not found.");

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        courierId: courier?.id ?? null,
        courierName: courier?.name ?? (input.courierName || "Courier"),
        trackingNumber: input.trackingNumber,
        consignmentId: input.trackingNumber,
        trackingUrl: buildTrackingUrl(courier?.trackingUrlTemplate ?? null, input.trackingNumber),
        status: "CREATED",
        courierCharge: input.courierCharge != null ? toMinor(input.courierCharge) : (courier?.defaultCharge ?? 0),
        note: input.note || null,
        createdById: user.id,
        events: {
          create: {
            status: "CREATED",
            description: `Parcel recorded by ${user.name ?? "staff"}`,
            source: "manual",
          },
        },
      },
      select: { id: true },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.COURIER_DISPATCHED,
      entityType: "order",
      entityId: order.id,
      summary: `Tracking ${input.trackingNumber} recorded manually`,
    });

    refreshOrder(order.id);
    return actionSuccess(`Tracking number saved. Shipment ${shipment.id.slice(-6)} is now on the timeline.`);
  } catch (error) {
    return actionFailure(error, "recordManualShipment");
  }
}

/** Pulls the latest status from the courier for one parcel. */
export async function syncShipmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COURIER_DISPATCH);
    const shipmentId = String(formData.get("shipmentId") ?? "");
    if (!shipmentId) throw errors.validation("Which shipment?");

    const result = await syncShipment(shipmentId, { id: user.id, name: user.name, role: user.role });

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, select: { orderId: true } });
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.COURIER_SYNCED,
      entityType: "shipment",
      entityId: shipmentId,
      summary: `Refreshed from courier: ${result.status}`,
    });

    if (shipment) refreshOrder(shipment.orderId);
    return actionSuccess(`Courier says: ${result.status.toLowerCase().replace(/_/g, " ")}.`);
  } catch (error) {
    return actionFailure(error, "syncShipment");
  }
}

/** Adds a status step by hand, for a courier that reports by phone. */
export async function addTrackingStepAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COURIER_DISPATCH);
    const input = trackingStepSchema.parse(formDataToObject(formData));

    await applyTracking(
      input.shipmentId,
      [
        {
          status: input.status,
          description: input.description || `Updated by ${user.name ?? "staff"}`,
          location: input.location || null,
          occurredAt: new Date(),
        },
      ],
      { source: "manual" },
    );

    const shipment = await prisma.shipment.findUnique({
      where: { id: input.shipmentId },
      select: { orderId: true },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.COURIER_SYNCED,
      entityType: "shipment",
      entityId: input.shipmentId,
      summary: `Status set to ${input.status} by hand`,
    });

    if (shipment) refreshOrder(shipment.orderId);
    return actionSuccess("Tracking updated.");
  } catch (error) {
    return actionFailure(error, "addTrackingStep");
  }
}

/** Records what the courier paid us for a parcel. */
export async function recordSettlementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COURIER_SETTLEMENT);
    const input = settlementSchema.parse(formDataToObject(formData));

    await recordSettlement(
      input.shipmentId,
      {
        collectedAmount: toMinor(input.collectedAmount),
        courierCharge: toMinor(input.courierCharge),
        settledAmount: toMinor(input.settledAmount),
        note: input.note || null,
      },
      { id: user.id, name: user.name, role: user.role },
    );

    const shipment = await prisma.shipment.findUnique({
      where: { id: input.shipmentId },
      select: { orderId: true },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.COURIER_SETTLED,
      entityType: "shipment",
      entityId: input.shipmentId,
      summary: `Settled ${input.settledAmount} against ${input.collectedAmount} collected`,
      severity: "WARNING",
    });

    if (shipment) refreshOrder(shipment.orderId);
    revalidatePath("/dashboard/finance", "layout");
    return actionSuccess("Settlement recorded and posted to the books.");
  } catch (error) {
    return actionFailure(error, "recordSettlement");
  }
}
