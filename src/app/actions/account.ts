"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { addressSchema, conversationSchema, messageSchema, reviewSchema } from "@/lib/validation/commerce";
import { formDataToObject } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { cancelOwnOrder } from "@/lib/services/orders";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { isStaffRole } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";

/* -------------------------------------------------------------------------- */
/* Addresses                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveAddressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const addressId = String(formData.get("addressId") ?? "");
    const input = addressSchema.parse(formDataToObject(formData));

    const district = await prisma.district.findFirst({
      where: { id: input.districtId, isActive: true },
      select: { name: true },
    });
    if (!district) throw errors.validation("Choose a valid district.", { districtId: "Invalid district." });

    if (addressId) {
      // Ownership check — an id belonging to someone else simply does not match.
      const owned = await prisma.address.findFirst({
        where: { id: addressId, userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw errors.notFound("Address not found.");
    }

    await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      }
      const data = {
        userId: user.id,
        label: input.label,
        type: input.type,
        fullName: input.fullName,
        phone: input.phone,
        districtId: input.districtId,
        districtName: district.name,
        city: input.city,
        area: input.area,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        postalCode: input.postalCode,
        isDefault: input.isDefault,
      };

      if (addressId) {
        await tx.address.update({ where: { id: addressId }, data });
      } else {
        const count = await tx.address.count({ where: { userId: user.id, deletedAt: null } });
        await tx.address.create({ data: { ...data, isDefault: input.isDefault || count === 0 } });
      }
    });

    revalidatePath("/account/addresses");
    return actionSuccess(addressId ? "Address updated." : "Address saved.");
  } catch (error) {
    return actionFailure(error, "saveAddress");
  }
}

export async function deleteAddressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const addressId = String(formData.get("addressId") ?? "");

    const result = await prisma.address.updateMany({
      where: { id: addressId, userId: user.id, deletedAt: null },
      data: { deletedAt: new Date(), isDefault: false },
    });
    if (result.count === 0) throw errors.notFound("Address not found.");

    revalidatePath("/account/addresses");
    return actionSuccess("Address removed.");
  } catch (error) {
    return actionFailure(error, "deleteAddress");
  }
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const orderId = String(formData.get("orderId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || "No reason given";

    await cancelOwnOrder(orderId, user, reason);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.ORDER_CANCELLED,
      entityType: "order",
      entityId: orderId,
      summary: `Customer cancelled their order: ${reason}`,
      severity: "NOTICE",
    });

    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath("/account/orders");
    return actionSuccess("Your order has been cancelled.");
  } catch (error) {
    return actionFailure(error, "cancelOrder");
  }
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Review eligibility (PRD §15): the customer must own an order item for this
 * product, that order must have reached the configured status (Delivered by
 * default), and the same line item cannot be reviewed twice.
 */
export async function submitReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("review", `user:${user.id}`);

    const settings = await getSettings();
    if (!settings.features.reviewsEnabled) throw errors.forbidden("Reviews are currently disabled.");

    const input = reviewSchema.parse(formDataToObject(formData));
    if (!input.orderItemId) throw errors.forbidden("You can only review products you have received.");

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: input.orderItemId,
        productId: input.productId,
        order: { userId: user.id },
      },
      select: {
        id: true,
        orderId: true,
        order: { select: { status: true } },
        reviews: { select: { id: true } },
      },
    });

    if (!orderItem) throw errors.forbidden("You can only review products you have purchased.");
    if (orderItem.reviews.length > 0) throw errors.conflict("You have already reviewed this item.");

    if (settings.features.requireDeliveredForReview && orderItem.order.status !== "DELIVERED") {
      throw errors.forbidden("You can review this product once your order has been delivered.");
    }

    const status = settings.features.autoApproveReviews ? "APPROVED" : "PENDING";

    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          productId: input.productId,
          userId: user.id,
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          rating: input.rating,
          title: input.title,
          body: input.body,
          status,
          isVerifiedPurchase: true,
          authorName: user.name,
        },
      });

      if (status === "APPROVED") await recalculateProductRating(tx, input.productId);
    });

    if (status === "PENDING") {
      await notify({
        audience: "STAFF",
        type: NOTIFICATION_TYPES.REVIEW_PENDING,
        title: "New review awaiting moderation",
        url: "/dashboard/reviews",
      });
    }

    revalidatePath("/account/reviews");
    return actionSuccess(
      status === "APPROVED" ? "Thanks — your review is now live." : "Thanks — your review will appear once approved.",
    );
  } catch (error) {
    return actionFailure(error, "submitReview");
  }
}

/** Recomputes a product's aggregate rating from approved reviews only. */
export async function recalculateProductRating(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const aggregate = await tx.review.aggregate({
    where: { productId, status: "APPROVED", deletedAt: null },
    _avg: { rating: true },
    _count: true,
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      ratingAverage: Number((aggregate._avg.rating ?? 0).toFixed(2)),
      ratingCount: aggregate._count,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Support messaging                                                           */
/* -------------------------------------------------------------------------- */

export async function startConversationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("message", `user:${user.id}`);

    const settings = await getSettings();
    if (!settings.features.messagingEnabled) throw errors.forbidden("Messaging is currently unavailable.");

    const input = conversationSchema.parse(formDataToObject(formData));

    // A customer may only attach one of their own orders to a conversation.
    let orderId: string | null = null;
    if (input.orderId) {
      const order = await prisma.order.findFirst({
        where: { id: input.orderId, userId: user.id },
        select: { id: true },
      });
      orderId = order?.id ?? null;
    }

    const conversation = await prisma.conversation.create({
      data: {
        subject: input.subject,
        customerId: user.id,
        orderId,
        status: "OPEN",
        unreadForStaff: true,
        messages: {
          create: {
            senderId: user.id,
            senderName: user.name,
            senderRole: "CUSTOMER",
            body: input.message,
          },
        },
      },
      select: { id: true },
    });

    await notify({
      audience: "STAFF",
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      title: `New support message: ${input.subject}`,
      body: user.name,
      url: `/dashboard/messages/${conversation.id}`,
    });

    revalidatePath("/account/messages");
    return actionSuccess("Message sent. Our team will reply here.");
  } catch (error) {
    return actionFailure(error, "startConversation");
  }
}

export async function replyToConversationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("message", `user:${user.id}`);

    const input = messageSchema.parse(formDataToObject(formData));

    const conversation = await prisma.conversation.findFirst({
      where: { id: input.conversationId, customerId: user.id, deletedAt: null },
      select: { id: true, subject: true },
    });
    if (!conversation) throw errors.notFound("Conversation not found.");

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          senderName: user.name,
          senderRole: "CUSTOMER",
          body: input.body,
          // A customer can never write an internal staff note.
          isInternal: false,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), unreadForStaff: true, status: "OPEN" },
      }),
    ]);

    await notify({
      audience: "STAFF",
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      title: `Reply on: ${conversation.subject}`,
      url: `/dashboard/messages/${conversation.id}`,
    });

    revalidatePath(`/account/messages/${conversation.id}`);
    return actionSuccess("Reply sent.");
  } catch (error) {
    return actionFailure(error, "replyToConversation");
  }
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export async function markNotificationsReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const notificationId = String(formData.get("notificationId") ?? "");

    /*
     * Staff also see broadcast rows (audience STAFF/ALL, no owner), which is
     * what their badge counts — so marking read has to cover them too, or the
     * badge could never reach zero. Those rows are shared, so clearing them
     * clears them for the whole team; that matches how a small shop works, and
     * per-person read receipts would need a join table.
     */
    const staff = isStaffRole(user.role);
    const visible = [
      { userId: user.id },
      ...(staff ? [{ audience: "STAFF" as const, userId: null }] : []),
      { audience: "ALL" as const, userId: null },
    ];

    if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, OR: visible },
        data: { isRead: true, readAt: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { isRead: false, OR: visible },
        data: { isRead: true, readAt: new Date() },
      });
    }

    revalidatePath("/account/notifications");
    revalidatePath("/dashboard/notifications");
    // The bell lives in the layout, so its badge is cached with it.
    revalidatePath("/", "layout");
    revalidatePath("/dashboard", "layout");
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "markNotificationsRead");
  }
}
