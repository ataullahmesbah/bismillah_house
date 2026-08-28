"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { createToken, reassignToken, TOKEN_STATUS_TRANSITIONS } from "@/lib/services/tokens";
import { notifyMany } from "@/lib/notifications";
import { createTokenSchema, tokenCommentSchema, tokenStatusSchema } from "@/lib/validation/tokens";
import { formDataToObject } from "@/lib/validation/common";

function refreshTokenViews(tokenId?: string) {
  revalidatePath("/dashboard/tokens");
  if (tokenId) revalidatePath(`/dashboard/tokens/${tokenId}`);
  // The sidebar badge lives in the layout.
  revalidatePath("/dashboard", "layout");
}

export async function createTokenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.TOKEN_CREATE);
    const input = createTokenSchema.parse({
      ...formDataToObject(formData),
      // Checkbox groups arrive as repeated keys.
      assigneeIds: formData.getAll("assigneeIds").map(String).filter(Boolean),
    });

    const token = await createToken({
      subject: input.subject,
      description: input.description,
      category: input.category,
      priority: input.priority,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      assigneeIds: input.assigneeIds,
      assignEveryone: input.assignEveryone,
      author: { id: user.id, name: user.name },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.TOKEN_CREATED,
      entityType: "token",
      entityId: token.id,
      summary: `Token ${token.reference} raised: ${token.subject}`,
    });

    refreshTokenViews(token.id);
    return actionSuccess(`Token ${token.reference} raised.`, `/dashboard/tokens/${token.id}`);
  } catch (error) {
    return actionFailure(error, "createToken");
  }
}

export async function assignTokenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.TOKEN_ASSIGN);
    const tokenId = String(formData.get("tokenId") ?? "");
    if (!tokenId) throw errors.validation("Token is required.");

    await reassignToken(
      tokenId,
      formData.getAll("assigneeIds").map(String).filter(Boolean),
      formData.get("assignEveryone") === "on",
      { id: user.id, name: user.name },
    );

    refreshTokenViews(tokenId);
    return actionSuccess("Assignees updated.");
  } catch (error) {
    return actionFailure(error, "assignToken");
  }
}

export async function updateTokenStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.TOKEN_CLOSE);
    const input = tokenStatusSchema.parse(formDataToObject(formData));

    const token = await prisma.token.findUnique({
      where: { id: input.tokenId },
      select: { id: true, reference: true, status: true, createdById: true, assignees: { select: { userId: true } } },
    });
    if (!token) throw errors.notFound("Token not found.");

    // Same rule as orders: the state machine is enforced on the server, not
    // just by which options the page happened to render.
    if (!TOKEN_STATUS_TRANSITIONS[token.status].includes(input.status)) {
      throw errors.validation(`A ${token.status.toLowerCase()} token cannot move to ${input.status.toLowerCase()}.`);
    }

    await prisma.token.update({
      where: { id: token.id },
      data: {
        status: input.status,
        resolvedAt: input.status === "RESOLVED" ? new Date() : null,
        closedAt: input.status === "CLOSED" ? new Date() : null,
      },
    });

    // Tell everyone involved except whoever made the change.
    const audience = new Set([token.createdById, ...token.assignees.map((a) => a.userId)]);
    audience.delete(user.id);
    await notifyMany(
      [...audience].map((userId) => ({
        userId,
        type: "token.status",
        title: `${token.reference} is now ${input.status.toLowerCase().replace("_", " ")}`,
        body: `${user.name} updated the token.`,
        url: `/dashboard/tokens/${token.id}`,
      })),
    );

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.TOKEN_UPDATED,
      entityType: "token",
      entityId: token.id,
      summary: `Token ${token.reference} → ${input.status}`,
    });

    refreshTokenViews(token.id);
    return actionSuccess("Token updated.");
  } catch (error) {
    return actionFailure(error, "updateTokenStatus");
  }
}

export async function commentOnTokenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.TOKEN_VIEW);
    const input = tokenCommentSchema.parse(formDataToObject(formData));

    const token = await prisma.token.findUnique({
      where: { id: input.tokenId },
      select: { id: true, reference: true, createdById: true, assignees: { select: { userId: true } } },
    });
    if (!token) throw errors.notFound("Token not found.");

    await prisma.tokenComment.create({
      data: { tokenId: token.id, authorId: user.id, body: input.body },
    });

    const audience = new Set([token.createdById, ...token.assignees.map((a) => a.userId)]);
    audience.delete(user.id);
    await notifyMany(
      [...audience].map((userId) => ({
        userId,
        type: "token.comment",
        title: `New reply on ${token.reference}`,
        body: `${user.name}: ${input.body.slice(0, 120)}`,
        url: `/dashboard/tokens/${token.id}`,
      })),
    );

    refreshTokenViews(token.id);
    return actionSuccess("Reply added.");
  } catch (error) {
    return actionFailure(error, "commentOnToken");
  }
}

/** Lets an assignee tick off their own part without closing the whole token. */
export async function markTokenDoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.TOKEN_VIEW);
    const tokenId = String(formData.get("tokenId") ?? "");

    const assignment = await prisma.tokenAssignee.findUnique({
      where: { tokenId_userId: { tokenId, userId: user.id } },
      select: { id: true, doneAt: true },
    });
    if (!assignment) throw errors.forbidden("This token is not assigned to you.");

    await prisma.tokenAssignee.update({
      where: { id: assignment.id },
      data: { doneAt: assignment.doneAt ? null : new Date() },
    });

    refreshTokenViews(tokenId);
    return actionSuccess(assignment.doneAt ? "Marked as still open." : "Marked done.");
  } catch (error) {
    return actionFailure(error, "markTokenDone");
  }
}
