import "server-only";

import { prisma } from "@/lib/db";
import { errors } from "@/lib/api";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, ShipmentStatus } from "@/generated/prisma/enums";
import { credentialsFor, getCourierAdapter } from "@/lib/courier/adapters";
import type { ParcelRequest, TrackingStep } from "@/lib/courier/types";
import { getSettingGroup } from "@/lib/settings";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";

/**
 * Handing parcels to couriers, and hearing back.
 *
 * The whole point is that nobody re-types an address into a courier's own
 * dashboard. Dispatch happens from the order screen, status comes back by
 * webhook, and what the courier eventually pays lands in the books — none of
 * which should require a person to reconcile two systems by eye.
 */

/** Statuses from which a parcel may be created. */
const DISPATCHABLE: OrderStatus[] = ["CONFIRMED", "PROCESSING", "PACKED"];

/** Courier status → the order status it implies, where there is one. */
const ORDER_STATUS_FROM_SHIPMENT: Partial<Record<ShipmentStatus, OrderStatus>> = {
  PICKED: "SHIPPED",
  IN_TRANSIT: "SHIPPED",
  AT_HUB: "SHIPPED",
  AT_DESTINATION: "SHIPPED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  RETURNED: "RETURNED",
};

export type DispatchActor = { id: string; name: string | null; role: string | null };

/**
 * Creates the parcel at the courier and records the shipment.
 *
 * Every attempt is logged whether it worked or not, because "I pressed send to
 * courier and nothing happened" is otherwise unanswerable. Credentials are
 * stripped from the logged request — they would otherwise sit in the database
 * in plain text, which is exactly what keeping them in env avoids.
 */
export async function dispatchToCourier(
  orderId: string,
  courierId: string,
  actor: DispatchActor,
  options: { note?: string | null } = {},
): Promise<{ shipmentId: string; trackingNumber: string }> {
  const [order, courier, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, orderNumber: true, publicToken: true, status: true, userId: true,
        customerName: true, customerPhone: true, grandTotal: true, paidTotal: true,
        paymentMethod: true, paymentStatus: true, shippingAddress: true, districtName: true,
        customerNote: true,
        items: { select: { productName: true, quantity: true, lineTotal: true } },
        shipments: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.courier.findUnique({ where: { id: courierId } }),
    getSettingGroup("courier"),
  ]);

  if (!order) throw errors.notFound("Order not found.");
  if (!courier) throw errors.notFound("That courier is not set up.");
  if (!courier.isActive) throw errors.validation(`${courier.name} is switched off in courier settings.`);

  if (!DISPATCHABLE.includes(order.status)) {
    throw errors.validation(
      `An order has to be confirmed before it can go to the courier. This one is ${order.status.toLowerCase()}.`,
    );
  }

  const live = order.shipments[0];
  if (live && live.status !== "CANCELLED" && live.status !== "FAILED") {
    throw errors.conflict("This order already has a parcel with the courier.");
  }

  const address = readAddress(order.shippingAddress);
  const adapter = getCourierAdapter(courier.provider);
  const credentials = credentialsFor(courier.code, courier.apiBaseUrl);

  if (!adapter.supportsApi || !credentials) {
    throw errors.validation(
      `${courier.name} has no API credentials configured, so the parcel has to be created in their dashboard. ` +
        `Add the tracking number here once you have it.`,
    );
  }

  // COD orders collect the outstanding balance; a paid order collects nothing.
  const collectAmount = Math.max(0, order.grandTotal - order.paidTotal);

  const request: ParcelRequest = {
    orderNumber: order.orderNumber,
    reference: order.publicToken,
    recipientName: order.customerName,
    recipientPhone: order.customerPhone,
    recipientAddress: [address.addressLine1, address.addressLine2, address.area, address.city, order.districtName]
      .filter(Boolean)
      .join(", "),
    recipientCity: address.city ?? order.districtName,
    recipientArea: address.area,
    collectAmount: order.paymentMethod === "COD" ? collectAmount : 0,
    itemValue: order.grandTotal,
    itemDescription: order.items.map((item) => `${item.productName} ×${item.quantity}`).join(", ").slice(0, 240),
    itemQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    weightGrams: 500,
    note: options.note ?? order.customerNote,
  };

  try {
    const result = await adapter.createParcel(request, credentials);

    const shipment = await prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          orderId: order.id,
          courierId: courier.id,
          courierName: courier.name,
          trackingNumber: result.trackingNumber,
          consignmentId: result.consignmentId,
          trackingUrl: buildTrackingUrl(courier.trackingUrlTemplate, result.trackingNumber) ?? result.trackingUrl ?? null,
          status: result.status,
          courierCharge: result.courierCharge ?? courier.defaultCharge,
          estimatedDeliveryAt: result.estimatedDeliveryAt ?? null,
          rawStatus: result.raw as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
          createdById: actor.id,
          note: options.note ?? null,
          events: {
            create: {
              status: result.status,
              description: `Parcel created with ${courier.name}`,
              source: "manual",
              raw: result.raw as Prisma.InputJsonValue,
            },
          },
        },
        select: { id: true },
      });

      await tx.courierDispatchLog.create({
        data: {
          orderId: order.id,
          shipmentId: created.id,
          courierCode: courier.code,
          operation: "create",
          success: true,
          statusCode: 200,
          request: redact(request) as Prisma.InputJsonValue,
          response: result.raw as Prisma.InputJsonValue,
          actorId: actor.id,
        },
      });

      return created;
    });

    if (settings.autoPostSettlementToFinance) {
      await postCourierCharge(order.id, shipment.id, result.courierCharge ?? courier.defaultCharge);
    }

    return { shipmentId: shipment.id, trackingNumber: result.trackingNumber };
  } catch (error) {
    await prisma.courierDispatchLog.create({
      data: {
        orderId: order.id,
        courierCode: courier.code,
        operation: "create",
        success: false,
        request: redact(request) as Prisma.InputJsonValue,
        errorMessage: (error as Error).message.slice(0, 500),
        actorId: actor.id,
      },
    });
    throw error;
  }
}

/**
 * Re-reads a parcel's status from the courier.
 *
 * The manual escape hatch for when a webhook is missed — and they are missed,
 * because a webhook that arrives while the site is deploying is simply gone.
 */
export async function syncShipment(shipmentId: string, actor: DispatchActor): Promise<{ status: ShipmentStatus }> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true, orderId: true, consignmentId: true, trackingNumber: true, syncAttempts: true,
      courier: { select: { id: true, code: true, name: true, provider: true, apiBaseUrl: true } },
    },
  });
  if (!shipment) throw errors.notFound("Shipment not found.");
  if (!shipment.courier) throw errors.validation("This shipment has no courier attached.");

  const adapter = getCourierAdapter(shipment.courier.provider);
  const credentials = credentialsFor(shipment.courier.code, shipment.courier.apiBaseUrl);
  const reference = shipment.consignmentId || shipment.trackingNumber;

  if (!adapter.supportsApi || !credentials || !reference) {
    throw errors.validation(`${shipment.courier.name} cannot be queried automatically. Update the status by hand.`);
  }

  try {
    const tracking = await adapter.track(reference, credentials);
    await applyTracking(shipment.id, tracking.steps.length > 0 ? tracking.steps : [{
      status: tracking.status,
      description: "Status refreshed from courier",
      occurredAt: new Date(),
    }], {
      source: "poll",
      currentLocation: tracking.currentLocation,
      deliveryManName: tracking.deliveryManName,
      deliveryManPhone: tracking.deliveryManPhone,
      estimatedDeliveryAt: tracking.estimatedDeliveryAt,
      collectedAmount: tracking.collectedAmount,
      courierCharge: tracking.courierCharge,
      raw: tracking.raw,
    });

    await prisma.courierDispatchLog.create({
      data: {
        orderId: shipment.orderId,
        shipmentId: shipment.id,
        courierCode: shipment.courier.code,
        operation: "sync",
        success: true,
        response: tracking.raw as Prisma.InputJsonValue,
        actorId: actor.id,
      },
    });

    return { status: tracking.status };
  } catch (error) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { syncAttempts: { increment: 1 }, syncError: (error as Error).message.slice(0, 300) },
    });
    await prisma.courierDispatchLog.create({
      data: {
        orderId: shipment.orderId,
        shipmentId: shipment.id,
        courierCode: shipment.courier.code,
        operation: "sync",
        success: false,
        errorMessage: (error as Error).message.slice(0, 500),
        actorId: actor.id,
      },
    });
    throw error;
  }
}

/**
 * Writes tracking steps onto a shipment and moves the order to match.
 *
 * Steps already recorded are skipped: couriers re-send webhooks, and a
 * timeline that says "picked up" four times is worse than no timeline.
 */
export async function applyTracking(
  shipmentId: string,
  steps: TrackingStep[],
  context: {
    source: "webhook" | "poll" | "manual";
    currentLocation?: string | null;
    deliveryManName?: string | null;
    deliveryManPhone?: string | null;
    estimatedDeliveryAt?: Date | null;
    collectedAmount?: number | null;
    courierCharge?: number | null;
    raw?: unknown;
  },
): Promise<void> {
  if (steps.length === 0) return;

  const settings = await getSettingGroup("courier");

  const existing = await prisma.shipmentEvent.findMany({
    where: { shipmentId },
    select: { status: true, occurredAt: true },
  });
  const seen = new Set(existing.map((event) => `${event.status}:${event.occurredAt.toISOString()}`));

  const fresh = steps
    .filter((step) => !seen.has(`${step.status}:${step.occurredAt.toISOString()}`))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (fresh.length === 0) {
    await prisma.shipment.update({ where: { id: shipmentId }, data: { lastSyncedAt: new Date() } });
    return;
  }

  const latest = fresh[fresh.length - 1]!;

  const shipment = await prisma.$transaction(async (tx) => {
    await tx.shipmentEvent.createMany({
      data: fresh.map((step) => ({
        shipmentId,
        status: step.status,
        description: step.description ?? null,
        location: step.location ?? null,
        occurredAt: step.occurredAt,
        source: context.source,
        raw: (step.raw ?? null) as Prisma.InputJsonValue,
      })),
    });

    return tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: latest.status,
        currentLocation: context.currentLocation ?? latest.location ?? undefined,
        deliveryManName: context.deliveryManName ?? undefined,
        deliveryManPhone: context.deliveryManPhone ?? undefined,
        estimatedDeliveryAt: context.estimatedDeliveryAt ?? undefined,
        collectedAmount: context.collectedAmount ?? undefined,
        courierCharge: context.courierCharge ?? undefined,
        pickupAt: fresh.find((step) => step.status === "PICKED")?.occurredAt ?? undefined,
        shippedAt: fresh.find((step) => step.status === "IN_TRANSIT")?.occurredAt ?? undefined,
        deliveredAt: latest.status === "DELIVERED" ? latest.occurredAt : undefined,
        lastSyncedAt: new Date(),
        syncError: null,
        rawStatus: (context.raw ?? null) as Prisma.InputJsonValue,
      },
      select: { id: true, orderId: true, courierName: true, trackingNumber: true, order: { select: { userId: true, orderNumber: true, status: true } } },
    });
  });

  // The order follows the parcel, but only forwards and only if the shop
  // asked for it — an admin who has already marked something delivered should
  // not have it dragged back by a late webhook.
  const nextOrderStatus = ORDER_STATUS_FROM_SHIPMENT[latest.status];
  if (settings.syncOrderStatusFromCourier && nextOrderStatus && nextOrderStatus !== shipment.order.status) {
    const { canTransition, changeOrderStatus } = await import("@/lib/services/orders");
    if (canTransition(shipment.order.status, nextOrderStatus)) {
      await changeOrderStatus(
        shipment.orderId,
        nextOrderStatus,
        { id: null, name: shipment.courierName ?? "Courier", role: null },
        `Reported by ${shipment.courierName ?? "the courier"}`,
      );
    }
  }

  if (shipment.order.userId) {
    await notify({
      userId: shipment.order.userId,
      type: NOTIFICATION_TYPES.ORDER_STATUS,
      title: `Order ${shipment.order.orderNumber}`,
      body: latest.description ?? `Parcel status: ${latest.status.toLowerCase().replace(/_/g, " ")}`,
      url: `/account/orders/${shipment.orderId}`,
    });
  }
}

/** Records what the courier actually paid us, and closes the receivable. */
export async function recordSettlement(
  shipmentId: string,
  input: { collectedAmount: number; courierCharge: number; settledAmount: number; note?: string | null },
  actor: DispatchActor,
): Promise<void> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, orderId: true, courierName: true, order: { select: { orderNumber: true, grandTotal: true } } },
  });
  if (!shipment) throw errors.notFound("Shipment not found.");

  const status =
    input.settledAmount <= 0
      ? "PENDING"
      : input.settledAmount + input.courierCharge >= input.collectedAmount
        ? "RECEIVED"
        : "PARTIAL";

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      collectedAmount: input.collectedAmount,
      courierCharge: input.courierCharge,
      settledAmount: input.settledAmount,
      settlementStatus: status,
      settledAt: status === "RECEIVED" ? new Date() : null,
      settlementNote: input.note ?? null,
    },
  });

  const settings = await getSettingGroup("courier");
  if (!settings.autoPostSettlementToFinance || input.settledAmount <= 0) return;

  // A settlement is NOT income. The sale was already booked as revenue when the
  // order was recognised; the courier handing the cash over is the same money
  // arriving, not new money. Posting it as income would count every delivered
  // order's revenue twice — once at delivery, once at settlement.
  //
  // So it is posted as a TRANSFER: it shows against the order and lands in the
  // cash account, and `getFinanceSummary` — which sums only INCOME and EXPENSE
  // — leaves profit alone.
  const { postTransaction } = await import("@/lib/services/finance");

  // An operator correcting a figure calls this again; without this check the
  // second call posts a second line and the cash balance drifts.
  const existing = await prisma.financeTransaction.findFirst({
    where: { shipmentId: shipment.id, kind: "TRANSFER", isAutomatic: true, voidedAt: null },
    select: { id: true },
  });
  if (existing) return;

  await postTransaction({
    kind: "TRANSFER",
    accountCode: "cash",
    amount: input.settledAmount,
    description: `Courier settlement received for ${shipment.order.orderNumber} (${shipment.courierName ?? "courier"})`,
    orderId: shipment.orderId,
    shipmentId: shipment.id,
    isAutomatic: true,
    actor,
  });
}

/** Posts the courier's delivery charge as an expense against the order. */
async function postCourierCharge(orderId: string, shipmentId: string, charge: number): Promise<void> {
  if (charge <= 0) return;

  // Dispatch can be retried after a failure; only the first attempt posts.
  const existing = await prisma.financeTransaction.findFirst({
    where: { orderId, kind: "EXPENSE", isAutomatic: true, voidedAt: null, category: { slug: "courier-charge" } },
    select: { id: true },
  });
  if (existing) return;

  const { postTransaction } = await import("@/lib/services/finance");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
  await postTransaction({
    kind: "EXPENSE",
    categorySlug: "courier-charge",
    accountCode: "cash",
    amount: charge,
    description: `Courier charge for ${order?.orderNumber ?? orderId}`,
    orderId,
    shipmentId,
    isAutomatic: true,
    actor: { id: null, name: "System", role: null },
  });
}

/* -------------------------------------------------------------------------- */

type StoredAddress = {
  addressLine1?: string;
  addressLine2?: string | null;
  area?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

function readAddress(value: Prisma.JsonValue): StoredAddress {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as StoredAddress;
  return {};
}

export function buildTrackingUrl(template: string | null, trackingNumber: string): string | null {
  if (!template || !trackingNumber) return null;
  return template.replace("{tracking}", encodeURIComponent(trackingNumber));
}

/**
 * Removes anything that should not sit in a log table.
 *
 * The parcel request carries the customer's full address and phone, which is
 * fine — it is already on the order — but nothing derived from a credential
 * ever goes in, and the note is truncated so a log row stays a log row.
 */
function redact(request: ParcelRequest): Record<string, unknown> {
  return {
    orderNumber: request.orderNumber,
    recipientCity: request.recipientCity,
    recipientArea: request.recipientArea,
    collectAmount: request.collectAmount,
    itemQuantity: request.itemQuantity,
    itemValue: request.itemValue,
    weightGrams: request.weightGrams,
    note: request.note?.slice(0, 120) ?? null,
  };
}
