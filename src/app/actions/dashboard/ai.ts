"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { generateProductDraft, type DraftPayload } from "@/lib/ai/product-draft";
import { getSettings } from "@/lib/settings";
import { toMinor } from "@/lib/money";
import { uniqueSlug } from "@/lib/utils";

function refreshDrafts(draftId?: string) {
  revalidatePath("/dashboard/products/ai");
  if (draftId) revalidatePath(`/dashboard/products/ai/${draftId}`);
}

/** Asks the AI for a product draft. Never publishes anything. */
export async function generateProductDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.AI_USE);
    const prompt = String(formData.get("prompt") ?? "").trim();
    if (prompt.length < 5) throw errors.validation("Describe the product you want drafted.");

    const { draftId } = await generateProductDraft(prompt, user.id);

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.AI_DRAFT_CREATED,
      entityType: "ai_draft",
      entityId: draftId,
      summary: prompt.slice(0, 160),
    });

    refreshDrafts(draftId);
    return actionSuccess("Draft ready. Read it through before publishing.", `/dashboard/products/ai/${draftId}`);
  } catch (error) {
    return actionFailure(error, "generateProductDraft");
  }
}

/**
 * Turns an approved draft into a real product.
 *
 * The product is created as a DRAFT regardless of what the AI produced —
 * publishing is a separate, deliberate act by someone with `product.publish`,
 * exactly as it is for a product typed by hand.
 */
export async function applyProductDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCT_CREATE);
    const draftId = String(formData.get("draftId") ?? "");
    if (!draftId) throw errors.validation("Which draft?");

    const draft = await prisma.aiProductDraft.findUnique({
      where: { id: draftId },
      select: { id: true, status: true, payload: true, productId: true },
    });
    if (!draft) throw errors.notFound("That draft no longer exists.");
    if (draft.productId) throw errors.validation("This draft has already been turned into a product.");
    if (draft.status !== "READY") throw errors.validation("That draft is not ready to publish.");

    const payload = draft.payload as unknown as DraftPayload | null;
    if (!payload?.name) throw errors.validation("That draft has no product in it.");

    // Whatever the operator edited on the review screen wins over the AI's
    // version — the form is the source of truth, the draft is a starting point.
    const name = String(formData.get("name") ?? payload.name).trim().slice(0, 200);
    const price = Number(formData.get("price") ?? 0) || 0;
    const categoryId = String(formData.get("categoryId") ?? "") || null;
    const brandId = String(formData.get("brandId") ?? "") || null;

    const settings = await getSettings();

    const slug = await uniqueSlug(payload.slug || name, async (candidate) =>
      (await prisma.product.count({ where: { slug: candidate } })) > 0,
    );

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        sku: payload.sku || null,
        categoryId,
        brandId,
        shortDescription: String(formData.get("shortDescription") ?? payload.shortDescription).slice(0, 500),
        description: String(formData.get("description") ?? payload.description).slice(0, 20_000),
        specifications: payload.specifications.length > 0 ? payload.specifications : undefined,
        price: toMinor(price),
        compareAtPrice: payload.suggestedCompareAtPrice ? toMinor(payload.suggestedCompareAtPrice) : null,
        tags: payload.tags,
        seoTitle: payload.seoTitle || null,
        seoDescription: payload.seoDescription || null,
        lowStockThreshold: settings.inventory.defaultLowStockThreshold,
        reorderLevel: settings.inventory.defaultReorderLevel,
        // Always a draft. The AI does not decide what goes live.
        status: "DRAFT",
        createdById: user.id,
      },
      select: { id: true, name: true },
    });

    await prisma.aiProductDraft.update({
      where: { id: draftId },
      data: { status: "APPLIED", productId: product.id, appliedAt: new Date() },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.AI_DRAFT_APPLIED,
      entityType: "product",
      entityId: product.id,
      summary: `Created "${product.name}" from an AI draft`,
      severity: "WARNING",
    });

    refreshDrafts(draftId);
    revalidatePath("/dashboard/products");
    return actionSuccess(
      "Product created as a draft. Add images and stock, then publish it.",
      `/dashboard/products/${product.id}`,
    );
  } catch (error) {
    return actionFailure(error, "applyProductDraft");
  }
}

export async function discardProductDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.AI_USE);
    const draftId = String(formData.get("draftId") ?? "");
    if (!draftId) throw errors.validation("Which draft?");

    await prisma.aiProductDraft.update({ where: { id: draftId }, data: { status: "DISCARDED" } });

    refreshDrafts(draftId);
    return actionSuccess("Draft discarded.");
  } catch (error) {
    return actionFailure(error, "discardProductDraft");
  }
}
