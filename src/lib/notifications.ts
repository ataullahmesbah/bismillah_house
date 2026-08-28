import "server-only";

import { prisma } from "@/lib/db";
import type { NotificationAudience } from "@/generated/prisma/enums";

/**
 * In-app notification centre.
 *
 * Delivery is intentionally abstracted behind `notify()` so an email, SMS or
 * push provider can be added later (PRD §16) without touching call sites.
 */

export type NotifyInput = {
  userId?: string | null;
  audience?: NotificationAudience;
  type: string;
  title: string;
  body?: string;
  url?: string;
  meta?: Record<string, unknown>;
};

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId ?? null,
        audience: input.audience ?? (input.userId ? "USER" : "STAFF"),
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 1000),
        url: input.url,
        meta: input.meta as object | undefined,
      },
    });
  } catch (error) {
    // Notifications are never allowed to fail an order or a status change.
    console.error("[trust-mart] notification failed", error);
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: inputs.map((input) => ({
        userId: input.userId ?? null,
        audience: input.audience ?? (input.userId ? "USER" : "STAFF"),
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 1000),
        url: input.url,
        meta: input.meta as object | undefined,
      })),
    });
  } catch (error) {
    console.error("[trust-mart] bulk notification failed", error);
  }
}

export const NOTIFICATION_TYPES = {
  ORDER_PLACED: "order.placed",
  ORDER_STATUS: "order.status",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_DELIVERED: "order.delivered",
  ORDER_REFUNDED: "order.refunded",
  REVIEW_APPROVED: "review.approved",
  REVIEW_PENDING: "review.pending",
  MESSAGE_RECEIVED: "message.received",
  PROMOTION: "promotion",
  LOW_STOCK: "inventory.low_stock",
  SYSTEM: "system",
} as const;

export async function unreadNotificationCount(userId: string, isStaff: boolean): Promise<number> {
  return prisma.notification.count({
    where: {
      isRead: false,
      OR: [{ userId }, ...(isStaff ? [{ audience: "STAFF" as const, userId: null }] : []), { audience: "ALL" as const, userId: null }],
    },
  });
}

export type NotificationSummary = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  isRead: boolean;
  createdAt: string;
};

/**
 * The most recent notifications for the bell dropdown.
 *
 * Mirrors the audience rules in `unreadNotificationCount`, so the badge and
 * the list it opens can never disagree about what someone is entitled to see.
 */
export async function recentNotifications(
  userId: string,
  isStaff: boolean,
  take = 8,
): Promise<NotificationSummary[]> {
  const rows = await prisma.notification.findMany({
    where: {
      OR: [
        { userId },
        ...(isStaff ? [{ audience: "STAFF" as const, userId: null }] : []),
        { audience: "ALL" as const, userId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, title: true, body: true, url: true, isRead: true, createdAt: true },
  });

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Notifies every staff member who actually holds a permission.
 *
 * Resolved through the same effective-permission logic the guards use — role
 * grants plus per-user overrides, with Super Admin implicitly holding
 * everything — so a shop that has moved a permission around still reaches the
 * right people. A broadcast to the STAFF audience would reach staff who cannot
 * act on it.
 */
export async function notifyStaffWithPermission(
  permission: string,
  notification: Omit<NotifyInput, "userId" | "audience">,
  excludeUserId?: string,
): Promise<void> {
  const { getEffectivePermissions } = await import("@/lib/auth/rbac");
  const { STAFF_ROLES } = await import("@/lib/constants");

  const staff = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, status: "ACTIVE", deletedAt: null },
    select: { id: true, role: true },
  });

  const recipients: string[] = [];
  for (const member of staff) {
    if (member.id === excludeUserId) continue;
    const permissions = await getEffectivePermissions(member.id, member.role);
    if (permissions.has(permission as never)) recipients.push(member.id);
  }

  await notifyMany(recipients.map((userId) => ({ ...notification, userId })));
}
