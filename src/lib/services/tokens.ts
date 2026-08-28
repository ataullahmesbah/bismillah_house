import "server-only";

import { prisma } from "@/lib/db";
import { errors } from "@/lib/api";
import { notifyMany } from "@/lib/notifications";
import { STAFF_ROLES } from "@/lib/constants";
import type { TokenCategory, TokenPriority, TokenStatus } from "@/generated/prisma/client";

/**
 * Internal tokens — the shop's own ticket queue.
 *
 * Staff raise a token for anything that needs someone else to act: a payment
 * to confirm, a delivery to chase, a product to check. It is deliberately
 * separate from customer conversations: nothing here is ever visible outside
 * the dashboard.
 */

export const TOKEN_CATEGORY_LABELS: Record<TokenCategory, string> = {
  ORDER: "Order",
  PAYMENT: "Payment",
  PRODUCT: "Product",
  CUSTOMER: "Customer",
  DELIVERY: "Delivery",
  TECHNICAL: "Technical",
  OTHER: "Other",
};

export const TOKEN_PRIORITY_LABELS: Record<TokenPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TOKEN_STATUS_LABELS: Record<TokenStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Statuses a token can move to from where it is now. */
export const TOKEN_STATUS_TRANSITIONS: Record<TokenStatus, TokenStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["OPEN"],
};

export type CreateTokenInput = {
  subject: string;
  description: string;
  category: TokenCategory;
  priority: TokenPriority;
  relatedType?: string | null;
  relatedId?: string | null;
  /** Explicit assignees, or empty with `assignEveryone` to reach all staff. */
  assigneeIds: string[];
  assignEveryone: boolean;
  author: { id: string; name: string };
};

/** Every staff account that can be assigned work. */
export async function assignableStaff() {
  return prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, status: "ACTIVE", deletedAt: null },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function createToken(input: CreateTokenInput) {
  const staff = await assignableStaff();

  // "Everyone" is resolved to real rows now, so the assignee list stays
  // accurate even after someone joins or leaves.
  const targetIds = input.assignEveryone
    ? staff.map((member) => member.id)
    : staff.filter((member) => input.assigneeIds.includes(member.id)).map((member) => member.id);

  if (targetIds.length === 0) {
    throw errors.validation("Choose at least one person to assign this token to.");
  }

  const token = await prisma.$transaction(async (tx) => {
    const [{ nextval }] = await tx.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('token_reference_seq') AS nextval
    `;
    const reference = `TKN-${String(nextval).padStart(6, "0")}`;

    return tx.token.create({
      data: {
        reference,
        subject: input.subject,
        description: input.description,
        category: input.category,
        priority: input.priority,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        createdById: input.author.id,
        assignees: { create: targetIds.map((userId) => ({ userId })) },
      },
      select: { id: true, reference: true, subject: true },
    });
  });

  await notifyAssignees(token, targetIds, input.author.name, input.priority);
  return token;
}

/** Replaces a token's assignees, notifying anyone newly added. */
export async function reassignToken(
  tokenId: string,
  assigneeIds: string[],
  assignEveryone: boolean,
  actor: { id: string; name: string },
) {
  const staff = await assignableStaff();
  const targetIds = assignEveryone
    ? staff.map((member) => member.id)
    : staff.filter((member) => assigneeIds.includes(member.id)).map((member) => member.id);

  if (targetIds.length === 0) {
    throw errors.validation("A token must stay assigned to at least one person.");
  }

  const token = await prisma.token.findUnique({
    where: { id: tokenId },
    select: { id: true, reference: true, subject: true, priority: true, assignees: { select: { userId: true } } },
  });
  if (!token) throw errors.notFound("Token not found.");

  const existing = new Set(token.assignees.map((assignee) => assignee.userId));
  const added = targetIds.filter((id) => !existing.has(id));

  await prisma.$transaction([
    prisma.tokenAssignee.deleteMany({ where: { tokenId, userId: { notIn: targetIds } } }),
    prisma.tokenAssignee.createMany({
      data: added.map((userId) => ({ tokenId, userId })),
      skipDuplicates: true,
    }),
  ]);

  // Only the people newly put on the token hear about it.
  if (added.length > 0) await notifyAssignees(token, added, actor.name, token.priority);
}

async function notifyAssignees(
  token: { id: string; reference: string; subject: string },
  userIds: string[],
  actorName: string,
  priority: TokenPriority,
) {
  await notifyMany(
    userIds.map((userId) => ({
      userId,
      type: "token.assigned",
      title: `${token.reference}: ${token.subject}`,
      body: `${actorName} assigned you a ${TOKEN_PRIORITY_LABELS[priority].toLowerCase()}-priority token.`,
      url: `/dashboard/tokens/${token.id}`,
    })),
  );
}

/** Tokens waiting on this person — what the sidebar badge counts. */
export async function openTokenCountFor(userId: string): Promise<number> {
  return prisma.token.count({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      assignees: { some: { userId } },
    },
  });
}
