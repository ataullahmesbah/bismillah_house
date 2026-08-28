import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentMethod, Role } from "@/generated/prisma/enums";
import { AppError, errors } from "@/lib/api";
import { generateOrderNumber, randomToken } from "@/lib/ids";
import {
  CUSTOMER_CANCELLABLE_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS,
  holdsReservation,
  STOCK_RELEASING_STATUSES,
} from "@/lib/constants";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications";
import { getSettings, getSettingGroup } from "@/lib/settings";
import type { SessionUser } from "@/lib/auth/session";
import { getCartView, clearCart, type CartView } from "./cart";
import { createInvoiceRecord } from "./invoice-builder";

/* -------------------------------------------------------------------------- */
/* Order creation                                                              */
/* -------------------------------------------------------------------------- */

export type CreateOrderInput = {
  fullName: string;
  phone: string;
  email: string | null;
  districtId: string;
  city: string | null;
  area: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string | null;
  paymentMethod: Exclude<PaymentMethod, "MANUAL">;
  bkashTransactionId?: string | null;
  bkashSenderNumber?: string | null;
  couponCode?: string | null;
  customerNote?: string | null;
  user: SessionUser | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type CreateOrderResult = {
  orderId: string;
  orderNumber: string;
  publicToken: string;
  grandTotal: number;
};

/**
 * Creates an order.
 *
 * Everything that decides money is recomputed here from the database — the
 * browser only says *what* to buy and *where* to send it. Inventory, coupon
 * usage, flash-sale counters, the order, its items, the payment record and the
 * invoice are all written in a single transaction so a failure anywhere leaves
 * no half-finished order behind.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const settings = await getSettings();

  if (!settings.features.guestCheckoutEnabled && !input.user) {
    throw errors.forbidden("Please sign in to place an order.");
  }
  if (settings.features.requireLoginForCheckout && !input.user) {
    throw errors.forbidden("Sign in is required to complete checkout.");
  }

  const methodEnabled: Record<string, boolean> = {
    COD: settings.payment.codEnabled,
    BKASH: settings.payment.bkashEnabled,
    SSLCOMMERZ: settings.payment.sslcommerzEnabled,
  };
  if (!methodEnabled[input.paymentMethod]) {
    throw errors.validation("That payment method is not available right now.");
  }

  const district = await prisma.district.findFirst({
    where: { id: input.districtId, isActive: true },
    select: { id: true, name: true, deliveryCharge: true, isFreeDelivery: true, estimatedDays: true },
  });
  if (!district) throw errors.validation("Choose a valid delivery district.");

  // Authoritative re-quote against live catalogue rows.
  const cart: CartView = await getCartView({
    couponCode: input.couponCode ?? null,
    districtId: district.id,
    guestEmail: input.email,
  });

  if (cart.isEmpty) throw errors.validation("Your cart is empty.");
  if (cart.hasUnavailable) {
    throw errors.conflict("Some items in your cart are no longer available. Please review your cart.");
  }
  if (input.couponCode && cart.quote.couponError) {
    throw errors.validation(cart.quote.couponError);
  }
  if (settings.payment.minOrderAmount > 0 && cart.quote.grandTotal < settings.payment.minOrderAmount) {
    throw errors.validation("Your order does not meet the minimum order amount.");
  }

  const quote = cart.quote;
  const availableLines = quote.lines.filter((line) => line.isAvailable);

  const shippingAddress = {
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    district: district.name,
    districtId: district.id,
    city: input.city,
    area: input.area,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    postalCode: input.postalCode,
  };

  const created = await prisma.$transaction(
    async (tx) => {
      // 1. Reserve stock. The conditional update is what prevents overselling
      //    under concurrent checkouts — if another order got there first the
      //    affected-row count is 0 and the whole transaction rolls back.
      for (const line of availableLines) {
        if (line.variant) {
          const updated = await tx.productVariant.updateMany({
            where: { id: line.variant.id, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity }, stockReserved: { increment: line.quantity } },
          });
          if (updated.count === 0) {
            throw errors.conflict(`${line.product.name} (${line.variant.name}) just went out of stock.`);
          }
          const fresh = await tx.productVariant.findUnique({
            where: { id: line.variant.id },
            select: { stock: true },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: line.product.id,
              variantId: line.variant.id,
              type: "SALE",
              quantityChange: -line.quantity,
              quantityAfter: fresh?.stock ?? 0,
              reason: "Order placed",
              referenceType: "order",
              actorId: input.user?.id ?? null,
            },
          });
        } else {
          const updated = await tx.product.updateMany({
            where: { id: line.product.id, stock: { gte: line.quantity } },
            data: {
              stock: { decrement: line.quantity },
              stockReserved: { increment: line.quantity },
              soldCount: { increment: line.quantity },
            },
          });
          if (updated.count === 0) {
            throw errors.conflict(`${line.product.name} just went out of stock.`);
          }
          const fresh = await tx.product.findUnique({
            where: { id: line.product.id },
            select: { stock: true },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: line.product.id,
              type: "SALE",
              quantityChange: -line.quantity,
              quantityAfter: fresh?.stock ?? 0,
              reason: "Order placed",
              referenceType: "order",
              actorId: input.user?.id ?? null,
            },
          });
        }

        // Flash sale allocation, also guarded against overselling the campaign.
        if (line.price.flashSaleItemId) {
          const claimed = await tx.flashSaleItem.updateMany({
            where: {
              id: line.price.flashSaleItemId,
              OR: [{ stockLimit: null }, { stockLimit: { gt: 0 } }],
            },
            data: { soldCount: { increment: line.quantity } },
          });
          if (claimed.count === 0) {
            throw errors.conflict("The flash sale for one of your items has ended.");
          }
        }
      }

      // 2. Coupon redemption — atomic and limit-safe.
      let couponId: string | null = null;
      if (quote.coupon) {
        const coupon = await tx.coupon.findUnique({
          where: { code: quote.coupon.code },
          select: { id: true, usageLimit: true },
        });
        if (!coupon) throw errors.validation("That coupon is no longer available.");

        const claimed = await tx.coupon.updateMany({
          where: {
            id: coupon.id,
            isActive: true,
            startAt: { lte: new Date() },
            endAt: { gt: new Date() },
            ...(coupon.usageLimit !== null ? { usageCount: { lt: coupon.usageLimit } } : {}),
          },
          data: { usageCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw errors.conflict("This coupon has just reached its usage limit.");
        }
        couponId = coupon.id;
      }

      // 3. Unique order number (collision is astronomically unlikely, but retried).
      let orderNumber = generateOrderNumber();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const clash = await tx.order.findUnique({ where: { orderNumber }, select: { id: true } });
        if (!clash) break;
        orderNumber = generateOrderNumber();
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          publicToken: randomToken(24),
          userId: input.user?.id ?? null,
          customerName: input.fullName,
          customerEmail: input.email,
          customerPhone: input.phone,
          status: "PENDING",
          paymentStatus: input.paymentMethod === "COD" ? "UNPAID" : "PENDING",
          paymentMethod: input.paymentMethod,
          subtotal: quote.subtotal,
          itemDiscountTotal: quote.flashDiscount,
          offerDiscount: quote.offerDiscount,
          couponDiscount: quote.couponDiscount,
          shippingTotal: quote.shipping.total,
          taxTotal: 0,
          grandTotal: quote.grandTotal,
          currency: "BDT",
          couponId,
          couponCode: quote.coupon?.code ?? null,
          couponSnapshot: quote.coupon
            ? { code: quote.coupon.code, title: quote.coupon.title, discount: quote.couponDiscount }
            : undefined,
          shippingSnapshot: {
            districtId: district.id,
            districtName: district.name,
            districtCharge: quote.shipping.districtCharge,
            strategy: quote.shipping.strategy,
            estimatedDays: quote.shipping.estimatedDays,
            breakdown: quote.shipping.breakdown,
            freeReason: quote.shipping.freeReason,
            total: quote.shipping.total,
          },
          shippingAddress,
          districtId: district.id,
          districtName: district.name,
          customerNote: input.customerNote ?? null,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent?.slice(0, 400) ?? null,
          items: {
            create: availableLines.map((line) => ({
              productId: line.product.id,
              variantId: line.variant?.id ?? null,
              productName: line.product.name,
              productSlug: line.product.slug,
              variantName: line.variant?.name ?? null,
              sku: line.variant?.sku ?? null,
              attributesSnapshot: line.variant?.attributes
                ? (line.variant.attributes as unknown as Prisma.InputJsonValue)
                : undefined,
              imageUrl: line.variant?.imageUrl ?? line.product.imageUrl ?? null,
              unitPrice: line.price.unitPrice,
              compareAtPrice: line.price.compareAtPrice,
              quantity: line.quantity,
              discountAmount: line.couponDiscount + line.flashDiscount + line.offerDiscount,
              lineSubtotal: line.lineSubtotal,
              lineTotal: line.lineTotal,
              shippingMode: line.product.shippingMode,
              shippingFee: line.product.shippingMode === "FIXED" ? (line.product.shippingFlatFee ?? 0) : 0,
            })),
          },
          statusEvents: {
            create: {
              toStatus: "PENDING",
              note: "Order placed",
              actorId: input.user?.id ?? null,
              actorName: input.user?.name ?? input.fullName,
              actorRole: input.user?.role ?? null,
            },
          },
          payments: {
            create: {
              provider: input.paymentMethod,
              status: input.paymentMethod === "COD" ? "PENDING" : "PENDING",
              amount: quote.grandTotal,
              currency: "BDT",
              transactionId: input.bkashTransactionId ?? null,
              senderNumber: input.bkashSenderNumber ?? null,
              idempotencyKey: `order-init-${orderNumber}`,
            },
          },
        },
        select: { id: true, orderNumber: true, publicToken: true, grandTotal: true },
      });

      if (couponId) {
        await tx.couponRedemption.create({
          data: {
            couponId,
            orderId: order.id,
            userId: input.user?.id ?? null,
            email: input.email,
            amount: quote.couponDiscount,
          },
        });
      }

      // 4. Immutable invoice generated from the order snapshot.
      await createInvoiceRecord(tx, order.id);

      return order;
    },
    { timeout: 20000, maxWait: 10000 },
  );

  if (cart.cartId) await clearCart(cart.cartId);

  // Notifications are best-effort and deliberately outside the transaction.
  if (input.user) {
    await notify({
      userId: input.user.id,
      type: NOTIFICATION_TYPES.ORDER_PLACED,
      title: `Order ${created.orderNumber} placed`,
      body: "We have received your order and will confirm it shortly.",
      url: `/account/orders/${created.id}`,
    });
  }
  await notify({
    audience: "STAFF",
    type: NOTIFICATION_TYPES.ORDER_PLACED,
    title: `New order ${created.orderNumber}`,
    body: `${input.fullName} • ${district.name}`,
    url: `/dashboard/orders/${created.id}`,
  });

  return {
    orderId: created.id,
    orderNumber: created.orderNumber,
    publicToken: created.publicToken,
    grandTotal: created.grandTotal,
  };
}

/* -------------------------------------------------------------------------- */
/* Invoice                                                                     */
/* -------------------------------------------------------------------------- */

export type { InvoiceSnapshot } from "./invoice-builder";
export { createInvoiceRecord } from "./invoice-builder";

/** Fetches (or lazily creates) the invoice for an order. */
export async function getInvoice(orderId: string, generatedById?: string) {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;
  return prisma.$transaction((tx) => createInvoiceRecord(tx, orderId, generatedById));
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                          */
/* -------------------------------------------------------------------------- */

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export type StatusChangeActor = {
  id: string | null;
  name: string;
  role: Role | null;
};

/**
 * Applies a lifecycle transition. Invalid moves are rejected, stock is returned
 * to inventory for cancel/reject/return, and every change is timestamped with
 * the actor for the order timeline.
 */
export async function changeOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  actor: StatusChangeActor,
  note?: string,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true, userId: true, paymentStatus: true, paymentMethod: true },
  });
  if (!order) throw errors.notFound("Order not found.");

  if (!canTransition(order.status, nextStatus)) {
    throw new AppError(
      `An order that is ${ORDER_STATUS_LABELS[order.status].toLowerCase()} cannot move to ${ORDER_STATUS_LABELS[nextStatus].toLowerCase()}.`,
      { status: 409, code: "INVALID_TRANSITION" },
    );
  }

  const releasesStock =
    STOCK_RELEASING_STATUSES.includes(nextStatus) && !STOCK_RELEASING_STATUSES.includes(order.status);

  // The reservation is given up either way — cancelled here, consumed by
  // despatch below — but only once, and only if this order still held it.
  const dropsReservation = holdsReservation(order.status) && !holdsReservation(nextStatus);
  const consumesReservation = dropsReservation && !releasesStock;

  await prisma.$transaction(async (tx) => {
    if (consumesReservation) {
      // Despatched: the units leave on-hand without becoming sellable again.
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, variantId: true, quantity: true },
      });
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockReserved: { decrement: item.quantity } },
          });
        } else if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockReserved: { decrement: item.quantity } },
          });
        }
      }
    }

    if (releasesStock) {
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, variantId: true, quantity: true },
      });
      for (const item of items) {
        if (item.variantId) {
          const updated = await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: item.quantity },
              // Only if this order was still holding it; a parcel that shipped
              // and came back released its reservation on the way out.
              ...(dropsReservation ? { stockReserved: { decrement: item.quantity } } : {}),
            },
            select: { stock: true, productId: true },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: updated.productId,
              variantId: item.variantId,
              type: nextStatus === "RETURNED" ? "RETURN" : "CANCELLATION",
              quantityChange: item.quantity,
              quantityAfter: updated.stock,
              reason: `Order ${order.orderNumber} → ${ORDER_STATUS_LABELS[nextStatus]}`,
              referenceType: "order",
              referenceId: orderId,
              actorId: actor.id,
            },
          });
        } else if (item.productId) {
          const updated = await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              soldCount: { decrement: item.quantity },
              ...(dropsReservation ? { stockReserved: { decrement: item.quantity } } : {}),
            },
            select: { stock: true },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: nextStatus === "RETURNED" ? "RETURN" : "CANCELLATION",
              quantityChange: item.quantity,
              quantityAfter: updated.stock,
              reason: `Order ${order.orderNumber} → ${ORDER_STATUS_LABELS[nextStatus]}`,
              referenceType: "order",
              referenceId: orderId,
              actorId: actor.id,
            },
          });
        }
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        confirmedAt: nextStatus === "CONFIRMED" ? new Date() : undefined,
        shippedAt: nextStatus === "SHIPPED" ? new Date() : undefined,
        deliveredAt: nextStatus === "DELIVERED" ? new Date() : undefined,
        cancelledAt: nextStatus === "CANCELLED" ? new Date() : undefined,
        cancelReason: nextStatus === "CANCELLED" ? (note ?? null) : undefined,
        isFlagged: nextStatus === "FRAUD_REVIEW" ? true : undefined,
        // Cash on delivery is settled the moment the parcel is handed over.
        paymentStatus:
          nextStatus === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus !== "PAID"
            ? "PAID"
            : undefined,
        paidTotal: undefined,
      },
    });

    if (nextStatus === "DELIVERED" && order.paymentMethod === "COD") {
      await tx.payment.updateMany({
        where: { orderId, status: { in: ["PENDING", "UNPAID"] } },
        data: { status: "PAID", paidAt: new Date() },
      });
    }

    await tx.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: nextStatus,
        note: note?.slice(0, 500) ?? null,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
      },
    });
  });

  // Post the sale into the books at whichever point the shop counts as
  // earned. Outside the transaction: a bookkeeping failure must never roll
  // back a status change the customer has already been told about, and
  // `postOrderRevenue` refuses to double-post.
  const financeSettings = await getSettingGroup("finance");
  const recognisesNow =
    financeSettings.revenueRecognition === "on_order"
      ? nextStatus === "CONFIRMED"
      : nextStatus === "DELIVERED";
  if (recognisesNow) {
    try {
      const { postOrderRevenue } = await import("@/lib/services/finance");
      await postOrderRevenue(orderId, actor);
    } catch (error) {
      console.error("[trust-mart] could not post order revenue", error);
    }
  }

  if (order.userId) {
    await notify({
      userId: order.userId,
      type: nextStatus === "DELIVERED" ? NOTIFICATION_TYPES.ORDER_DELIVERED : NOTIFICATION_TYPES.ORDER_STATUS,
      title: `Order ${order.orderNumber} — ${ORDER_STATUS_LABELS[nextStatus]}`,
      body: note ?? `Your order status changed to ${ORDER_STATUS_LABELS[nextStatus].toLowerCase()}.`,
      url: `/account/orders/${orderId}`,
    });
  }
}

/** A customer may only cancel their own order, and only while it is early. */
export async function cancelOwnOrder(orderId: string, user: SessionUser, reason: string): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!order) throw errors.notFound("Order not found.");
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
    throw errors.conflict("This order can no longer be cancelled. Please contact support.");
  }
  await changeOrderStatus(
    orderId,
    "CANCELLED",
    { id: user.id, name: user.name, role: user.role },
    `Cancelled by customer: ${reason}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Review eligibility                                                          */
/* -------------------------------------------------------------------------- */

/** Products this customer is allowed to review (delivered + not yet reviewed). */
export async function getReviewableItems(userId: string) {
  const settings = await getSettings();
  const statuses: OrderStatus[] = settings.features.requireDeliveredForReview
    ? ["DELIVERED"]
    : ["DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY", "CONFIRMED", "PROCESSING", "PACKED"];

  return prisma.orderItem.findMany({
    where: {
      order: { userId, status: { in: statuses } },
      productId: { not: null },
      reviews: { none: {} },
    },
    select: {
      id: true,
      productName: true,
      variantName: true,
      imageUrl: true,
      productId: true,
      order: { select: { id: true, orderNumber: true, deliveredAt: true } },
      product: { select: { slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
