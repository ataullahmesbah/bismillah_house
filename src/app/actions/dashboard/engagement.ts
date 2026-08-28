"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { messageSchema, reviewModerationSchema } from "@/lib/validation/commerce";
import { formDataToObject, requiredText, optionalText } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notify, notifyMany, NOTIFICATION_TYPES } from "@/lib/notifications";
import { recalculateProductRating } from "@/app/actions/account";

/* -------------------------------------------------------------------------- */
/* Review moderation                                                           */
/* -------------------------------------------------------------------------- */

export async function moderateReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.REVIEW_MODERATE);
    const input = reviewModerationSchema.parse(formDataToObject(formData));

    const review = await prisma.review.findUnique({
      where: { id: input.reviewId },
      select: { id: true, productId: true, userId: true, status: true, product: { select: { name: true, slug: true } } },
    });
    if (!review) throw errors.notFound("Review not found.");

    await prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: input.reviewId },
        data: {
          status: input.status,
          reply: input.reply,
          repliedById: input.reply ? user.id : undefined,
          repliedAt: input.reply ? new Date() : undefined,
        },
      });
      await recalculateProductRating(tx, review.productId);
    });

    if (input.status === "APPROVED" && review.userId) {
      await notify({
        userId: review.userId,
        type: NOTIFICATION_TYPES.REVIEW_APPROVED,
        title: "Your review is live",
        body: `Your review of ${review.product.name} has been published.`,
        url: `/product/${review.product.slug}#reviews`,
      });
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.REVIEW_MODERATED,
      entityType: "review",
      entityId: input.reviewId,
      summary: `Review on “${review.product.name}”: ${review.status} → ${input.status}`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/reviews");
    revalidatePath(`/product/${review.product.slug}`);
    return actionSuccess("Review updated.");
  } catch (error) {
    return actionFailure(error, "moderateReview");
  }
}

export async function deleteReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.REVIEW_MODERATE);
    const id = String(formData.get("id") ?? "");

    const review = await prisma.review.findUnique({ where: { id }, select: { productId: true } });
    if (!review) throw errors.notFound("Review not found.");

    await prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: { deletedAt: new Date(), status: "REJECTED" } });
      await recalculateProductRating(tx, review.productId);
    });

    await recordAudit({
      actor: user, action: AUDIT_ACTIONS.REVIEW_MODERATED, entityType: "review", entityId: id,
      summary: "Review removed", severity: "WARNING",
    });

    revalidatePath("/dashboard/reviews");
    return actionSuccess("Review removed.");
  } catch (error) {
    return actionFailure(error, "deleteReview");
  }
}

/* -------------------------------------------------------------------------- */
/* Support conversations                                                       */
/* -------------------------------------------------------------------------- */

export async function staffReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.MESSAGE_REPLY);
    const input = messageSchema.parse(formDataToObject(formData));

    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { id: true, subject: true, customerId: true },
    });
    if (!conversation) throw errors.notFound("Conversation not found.");

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          senderName: user.name,
          senderRole: "STAFF",
          body: input.body,
          isInternal: input.isInternal,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadForStaff: false,
          // An internal note must not look like a reply to the customer.
          unreadForCustomer: input.isInternal ? undefined : true,
          status: input.isInternal ? undefined : "PENDING",
        },
      }),
    ]);

    if (!input.isInternal && conversation.customerId) {
      await notify({
        userId: conversation.customerId,
        type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
        title: `Reply from support: ${conversation.subject}`,
        url: `/account/messages/${conversation.id}`,
      });
    }

    revalidatePath(`/dashboard/messages/${conversation.id}`);
    return actionSuccess(input.isInternal ? "Internal note added." : "Reply sent.");
  } catch (error) {
    return actionFailure(error, "staffReply");
  }
}

export async function updateConversationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.MESSAGE_VIEW);
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    const assignedToId = String(formData.get("assignedToId") ?? "") || null;

    if (status && !["OPEN", "PENDING", "RESOLVED", "CLOSED"].includes(status)) {
      throw errors.validation("Invalid status.");
    }

    const before = await prisma.conversation.findUnique({
      where: { id },
      select: { assignedToId: true, subject: true },
    });
    if (!before) throw errors.notFound("Conversation not found.");

    await prisma.conversation.update({
      where: { id },
      data: {
        ...(status ? { status: status as "OPEN" | "PENDING" | "RESOLVED" | "CLOSED" } : {}),
        assignedToId,
        unreadForStaff: false,
      },
    });

    /*
     * Handing a conversation to someone is only useful if they find out, and
     * if the rest of the team can see who did the handing. The note is an
     * internal message: it lives in the same thread the staff are reading,
     * but `isInternal` keeps it out of every customer-facing query.
     */
    if (assignedToId && assignedToId !== before.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, name: true },
      });

      if (assignee) {
        await prisma.message.create({
          data: {
            conversationId: id,
            senderId: user.id,
            senderName: user.name,
            senderRole: "STAFF",
            isInternal: true,
            body: `${user.name} assigned this conversation to ${assignee.name}.`,
          },
        });

        if (assignee.id !== user.id) {
          await notifyMany([{
            userId: assignee.id,
            type: "conversation.assigned",
            title: `You were assigned: ${before.subject}`,
            body: `${user.name} asked you to handle this customer conversation.`,
            url: `/dashboard/messages/${id}`,
          }]);
        }
      }
    }

    await recordAudit({
      actor: user, action: "conversation.updated", entityType: "conversation", entityId: id,
      summary: `Conversation set to ${status || "unchanged"}${assignedToId ? " and reassigned" : ""}`,
    });

    revalidatePath(`/dashboard/messages/${id}`);
    revalidatePath("/dashboard/messages");
    return actionSuccess("Conversation updated.");
  } catch (error) {
    return actionFailure(error, "updateConversation");
  }
}

export async function updateLeadStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.MESSAGE_VIEW);
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "NEW");
    await prisma.contactLead.update({ where: { id }, data: { status: status.slice(0, 30) } });
    revalidatePath("/dashboard/leads");
    return actionSuccess("Lead updated.");
  } catch (error) {
    return actionFailure(error, "updateLeadStatus");
  }
}

/* -------------------------------------------------------------------------- */
/* Broadcast notifications                                                     */
/* -------------------------------------------------------------------------- */

const broadcastSchema = z.object({
  title: requiredText("Title", 200),
  body: optionalText(1000),
  url: optionalText(500),
  audience: z.enum(["ALL_CUSTOMERS", "STAFF"]),
});

export async function sendBroadcastAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_SEND);
    const input = broadcastSchema.parse(formDataToObject(formData));

    if (input.audience === "STAFF") {
      await notify({
        audience: "STAFF",
        type: NOTIFICATION_TYPES.SYSTEM,
        title: input.title,
        body: input.body ?? undefined,
        url: input.url ?? undefined,
      });
    } else {
      // Batched so a large customer base does not build one huge statement.
      const customers = await prisma.user.findMany({
        where: { role: "CUSTOMER", status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });

      for (let index = 0; index < customers.length; index += 500) {
        await notifyMany(
          customers.slice(index, index + 500).map((customer) => ({
            userId: customer.id,
            type: NOTIFICATION_TYPES.PROMOTION,
            title: input.title,
            body: input.body ?? undefined,
            url: input.url ?? undefined,
          })),
        );
      }
    }

    await recordAudit({
      actor: user,
      action: "notification.broadcast",
      entityType: "notification",
      summary: `Broadcast “${input.title}” to ${input.audience}`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/notifications");
    return actionSuccess("Notification sent.");
  } catch (error) {
    return actionFailure(error, "sendBroadcast");
  }
}

export async function markStaffNotificationsReadAction(): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_VIEW);
    await prisma.notification.updateMany({
      where: { OR: [{ userId: user.id }, { audience: "STAFF", userId: null }], isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    revalidatePath("/dashboard/notifications");
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "markStaffNotificationsRead");
  }
}
