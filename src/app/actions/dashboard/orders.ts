"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import {
  customerHistorySearchSchema, orderNoteSchema, orderStatusSchema,
  paymentUpdateSchema, refundSchema,
} from "@/lib/validation/commerce";
import { formDataToObject } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { changeOrderStatus } from "@/lib/services/orders";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateOrderStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_UPDATE_STATUS);
    const input = orderStatusSchema.parse(formDataToObject(formData));

    const before = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { status: true, orderNumber: true },
    });
    if (!before) throw errors.notFound("Order not found.");

    await changeOrderStatus(
      input.orderId,
      input.status,
      { id: user.id, name: user.name, role: user.role },
      input.note ?? undefined,
    );

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      entityType: "order",
      entityId: input.orderId,
      summary: `Order ${before.orderNumber}: ${before.status} → ${input.status}`,
      before: { status: before.status },
      after: { status: input.status, note: input.note },
      severity: "NOTICE",
    });

    revalidatePath(`/dashboard/orders/${input.orderId}`);
    revalidatePath("/dashboard/orders");
    return actionSuccess("Order status updated.");
  } catch (error) {
    return actionFailure(error, "updateOrderStatus");
  }
}

export async function addOrderNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_INTERNAL_NOTE);
    const input = orderNoteSchema.parse(formDataToObject(formData));

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { internalNote: true, orderNumber: true },
    });
    if (!order) throw errors.notFound("Order not found.");

    const stamped = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] ${user.name}: ${input.note}`;
    const merged = order.internalNote ? `${order.internalNote}\n${stamped}` : stamped;

    await prisma.order.update({
      where: { id: input.orderId },
      data: { internalNote: merged.slice(-8000) },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.ORDER_NOTE_ADDED,
      entityType: "order",
      entityId: input.orderId,
      summary: `Internal note added to ${order.orderNumber}`,
    });

    revalidatePath(`/dashboard/orders/${input.orderId}`);
    return actionSuccess("Note added.");
  } catch (error) {
    return actionFailure(error, "addOrderNote");
  }
}

export async function flagOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_FRAUD_REVIEW);
    const orderId = String(formData.get("orderId") ?? "");
    const flagged = formData.get("flagged") === "true";
    const reason = String(formData.get("reason") ?? "").slice(0, 300) || null;

    await prisma.order.update({
      where: { id: orderId },
      data: { isFlagged: flagged, flagReason: flagged ? reason : null },
    });

    await recordAudit({
      actor: user,
      action: "order.fraud.flag",
      entityType: "order",
      entityId: orderId,
      summary: flagged ? `Flagged for review: ${reason ?? "no reason given"}` : "Fraud flag cleared",
      severity: "WARNING",
    });

    revalidatePath(`/dashboard/orders/${orderId}`);
    revalidatePath("/dashboard/orders/fraud-review");
    return actionSuccess(flagged ? "Order flagged for review." : "Flag cleared.");
  } catch (error) {
    return actionFailure(error, "flagOrder");
  }
}

/* -------------------------------------------------------------------------- */
/* Payments, refunds and shipments                                             */
/* -------------------------------------------------------------------------- */

export async function updatePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_REFUND);
    const input = paymentUpdateSchema.parse(formDataToObject(formData));

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { orderNumber: true, paymentStatus: true, grandTotal: true },
    });
    if (!order) throw errors.notFound("Order not found.");

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: input.orderId },
        data: {
          paymentStatus: input.paymentStatus,
          paidTotal: input.paidAmount ?? (input.paymentStatus === "PAID" ? order.grandTotal : undefined),
        },
      });
      await tx.payment.updateMany({
        where: { orderId: input.orderId },
        data: {
          status: input.paymentStatus,
          transactionId: input.transactionId ?? undefined,
          paidAt: input.paymentStatus === "PAID" ? new Date() : undefined,
        },
      });
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.PAYMENT_UPDATED,
      entityType: "order",
      entityId: input.orderId,
      summary: `Payment for ${order.orderNumber}: ${order.paymentStatus} → ${input.paymentStatus}`,
      before: { paymentStatus: order.paymentStatus },
      after: { paymentStatus: input.paymentStatus },
      severity: "WARNING",
    });

    revalidatePath(`/dashboard/orders/${input.orderId}`);
    return actionSuccess("Payment updated.");
  } catch (error) {
    return actionFailure(error, "updatePayment");
  }
}

export async function createRefundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_REFUND);
    const input = refundSchema.parse(formDataToObject(formData));

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { orderNumber: true, grandTotal: true, refundedTotal: true, userId: true },
    });
    if (!order) throw errors.notFound("Order not found.");

    const remaining = order.grandTotal - order.refundedTotal;
    if (input.amount > remaining) {
      throw errors.validation(`The maximum refundable amount is ${formatMoney(remaining)}.`, { amount: "Too high." });
    }

    const refundedTotal = order.refundedTotal + input.amount;

    await prisma.$transaction([
      prisma.refund.create({
        data: {
          orderId: input.orderId,
          amount: input.amount,
          reason: input.reason,
          status: "PROCESSED",
          requestedById: user.id,
          approvedById: user.id,
          processedAt: new Date(),
        },
      }),
      prisma.order.update({
        where: { id: input.orderId },
        data: {
          refundedTotal,
          paymentStatus: refundedTotal >= order.grandTotal ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      }),
    ]);

    if (order.userId) {
      await notify({
        userId: order.userId,
        type: NOTIFICATION_TYPES.ORDER_REFUNDED,
        title: `Refund issued for ${order.orderNumber}`,
        body: `${formatMoney(input.amount)} has been refunded.`,
        url: `/account/orders/${input.orderId}`,
      });
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.ORDER_REFUNDED,
      entityType: "order",
      entityId: input.orderId,
      summary: `Refunded ${formatMoney(input.amount)} on ${order.orderNumber}: ${input.reason}`,
      severity: "WARNING",
    });

    revalidatePath(`/dashboard/orders/${input.orderId}`);
    return actionSuccess("Refund recorded.");
  } catch (error) {
    return actionFailure(error, "createRefund");
  }
}

export type CustomerHistoryResult = {
  query: string;
  totals: {
    orders: number;
    delivered: number;
    cancelled: number;
    rejected: number;
    returned: number;
    fraudReview: number;
    lifetimeValue: number;
  };
  riskNote: string | null;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    grandTotal: number;
    placedAt: string;
    districtName: string | null;
    customerName: string;
  }>;
};

export type CustomerHistoryState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; result: CustomerHistoryResult };

/**
 * Phone / email order-history lookup for support and fraud screening
 * (PRD §11). Restricted by permission, never exposed publicly, and every
 * search is written to the audit log with the actor and the term used.
 */
export async function searchCustomerHistoryAction(
  _prev: CustomerHistoryState,
  formData: FormData,
): Promise<CustomerHistoryState> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_CUSTOMER_SEARCH);
    const input = customerHistorySearchSchema.parse(formDataToObject(formData));
    const query = input.query.trim();
    const digits = query.replace(/\D/g, "");

    const orders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(digits.length >= 6 ? [{ customerPhone: { contains: digits.slice(-9) } }] : []),
          { customerEmail: { equals: query, mode: "insensitive" as const } },
          { customerPhone: { contains: query } },
        ],
      },
      orderBy: { placedAt: "desc" },
      take: 100,
      select: {
        id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true,
        placedAt: true, districtName: true, customerName: true,
      },
    });

    const totals = {
      orders: orders.length,
      delivered: orders.filter((order) => order.status === "DELIVERED").length,
      cancelled: orders.filter((order) => order.status === "CANCELLED").length,
      rejected: orders.filter((order) => order.status === "REJECTED").length,
      returned: orders.filter((order) => order.status === "RETURNED" || order.status === "REFUNDED").length,
      fraudReview: orders.filter((order) => order.status === "FRAUD_REVIEW").length,
      lifetimeValue: orders
        .filter((order) => order.status === "DELIVERED")
        .reduce((sum, order) => sum + order.grandTotal, 0),
    };

    const badOutcomes = totals.rejected + totals.returned + totals.cancelled;
    const riskNote =
      totals.orders >= 3 && badOutcomes / totals.orders >= 0.5
        ? "High proportion of cancelled, rejected or returned orders — verify before dispatch."
        : totals.fraudReview > 0
          ? "This customer has an order currently in fraud review."
          : null;

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.CUSTOMER_SEARCH,
      entityType: "order_search",
      summary: `Searched customer order history for “${query}” (${orders.length} results)`,
      severity: "NOTICE",
    });

    return {
      status: "success",
      result: {
        query,
        totals,
        riskNote,
        orders: orders.map((order) => ({
          ...order,
          placedAt: order.placedAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    const failure = actionFailure(error, "searchCustomerHistory");
    return { status: "error", message: failure.status === "error" ? failure.message : "Search failed." };
  }
}
