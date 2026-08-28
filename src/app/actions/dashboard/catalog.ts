"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { userHasPermission } from "@/lib/auth/rbac";
import { notifyMany, notifyStaffWithPermission } from "@/lib/notifications";
import {
  attributeSchema, brandSchema, categorySchema, inventoryAdjustSchema, productSchema,
} from "@/lib/validation/catalog";
import { formDataList, formDataToObject } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { slugify, uniqueSlug } from "@/lib/utils";
import { destroyAsset } from "@/lib/cloudinary";

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.CATEGORY_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = categorySchema.parse(formDataToObject(formData));

    const slug = input.slug
      ? slugify(input.slug)
      : await uniqueSlug(input.name, async (candidate) =>
          Boolean(await prisma.category.findFirst({ where: { slug: candidate, NOT: id ? { id } : undefined }, select: { id: true } })));

    // A category cannot be its own parent, nor a child of itself.
    if (id && input.parentId === id) {
      throw errors.validation("A category cannot be its own parent.", { parentId: "Invalid parent." });
    }

    const data = {
      name: input.name,
      slug,
      parentId: input.parentId,
      description: input.description,
      imageUrl: input.imageUrl,
      bannerUrl: input.bannerUrl,
      iconName: input.iconName,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      position: input.position,
      isActive: input.isActive,
      showInMenu: input.showInMenu,
      isFeatured: input.isFeatured,
    };

    const saved = id
      ? await prisma.category.update({ where: { id }, data })
      : await prisma.category.create({ data });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.CONTENT_CHANGED,
      entityType: "category",
      entityId: saved.id,
      summary: `${id ? "Updated" : "Created"} category “${saved.name}”`,
      after: data,
    });

    revalidatePath("/dashboard/categories");
    revalidatePath("/");
    return actionSuccess(id ? "Category updated." : "Category created.");
  } catch (error) {
    return actionFailure(error, "saveCategory");
  }
}

/** Categories are archived, never hard-deleted, so historic orders keep context. */
export async function archiveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.CATEGORY_MANAGE);
    const id = String(formData.get("id") ?? "");

    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { products: true, children: true } } },
    });
    if (!category) throw errors.notFound("Category not found.");

    if (category._count.children > 0) {
      throw errors.conflict("Move or archive the subcategories first.");
    }

    await prisma.category.update({
      where: { id },
      data: { isActive: false, showInMenu: false, deletedAt: new Date() },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.CONTENT_CHANGED,
      entityType: "category",
      entityId: id,
      summary: `Archived category “${category.name}” (${category._count.products} products kept)`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/categories");
    return actionSuccess("Category archived.");
  } catch (error) {
    return actionFailure(error, "archiveCategory");
  }
}

/* -------------------------------------------------------------------------- */
/* Brands                                                                      */
/* -------------------------------------------------------------------------- */

export async function saveBrandAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BRAND_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = brandSchema.parse(formDataToObject(formData));

    const slug = input.slug
      ? slugify(input.slug)
      : await uniqueSlug(input.name, async (candidate) =>
          Boolean(await prisma.brand.findFirst({ where: { slug: candidate, NOT: id ? { id } : undefined }, select: { id: true } })));

    const data = {
      name: input.name,
      slug,
      logoUrl: input.logoUrl,
      description: input.description,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      position: input.position,
      isActive: input.isActive,
    };

    const saved = id ? await prisma.brand.update({ where: { id }, data }) : await prisma.brand.create({ data });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.CONTENT_CHANGED,
      entityType: "brand",
      entityId: saved.id,
      summary: `${id ? "Updated" : "Created"} brand “${saved.name}”`,
    });

    revalidatePath("/dashboard/brands");
    return actionSuccess(id ? "Brand updated." : "Brand created.");
  } catch (error) {
    return actionFailure(error, "saveBrand");
  }
}

export async function archiveBrandAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BRAND_MANAGE);
    const id = String(formData.get("id") ?? "");
    await prisma.brand.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    await recordAudit({ actor: user, action: AUDIT_ACTIONS.CONTENT_CHANGED, entityType: "brand", entityId: id, summary: "Archived brand" });
    revalidatePath("/dashboard/brands");
    return actionSuccess("Brand archived.");
  } catch (error) {
    return actionFailure(error, "archiveBrand");
  }
}

/* -------------------------------------------------------------------------- */
/* Attributes (the reusable variant dimensions)                                */
/* -------------------------------------------------------------------------- */

export async function saveAttributeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTRIBUTE_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = attributeSchema.parse(formDataToObject(formData));

    const slug = input.slug
      ? slugify(input.slug)
      : await uniqueSlug(input.name, async (candidate) =>
          Boolean(await prisma.attribute.findFirst({ where: { slug: candidate, NOT: id ? { id } : undefined }, select: { id: true } })));

    // Options are entered one per line (or comma separated) — e.g. "500g, 1kg, 2kg".
    const optionValues = input.options
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 200);

    const attribute = id
      ? await prisma.attribute.update({
          where: { id },
          data: { name: input.name, slug, type: input.type, unit: input.unit, position: input.position, isActive: input.isActive },
        })
      : await prisma.attribute.create({
          data: { name: input.name, slug, type: input.type, unit: input.unit, position: input.position, isActive: input.isActive },
        });

    if (optionValues.length > 0) {
      const existing = await prisma.attributeOption.findMany({
        where: { attributeId: attribute.id },
        select: { value: true },
      });
      const existingValues = new Set(existing.map((option) => option.value.toLowerCase()));

      const toCreate = optionValues
        .filter((value) => !existingValues.has(value.toLowerCase()))
        .map((value, index) => ({
          attributeId: attribute.id,
          value: value.toLowerCase().replace(/\s+/g, "-"),
          label: value,
          position: existing.length + index,
        }));

      if (toCreate.length > 0) {
        await prisma.attributeOption.createMany({ data: toCreate, skipDuplicates: true });
      }
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.CONTENT_CHANGED,
      entityType: "attribute",
      entityId: attribute.id,
      summary: `${id ? "Updated" : "Created"} attribute “${attribute.name}”`,
    });

    revalidatePath("/dashboard/attributes");
    return actionSuccess(id ? "Attribute updated." : "Attribute created.");
  } catch (error) {
    return actionFailure(error, "saveAttribute");
  }
}

export async function deleteAttributeOptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.ATTRIBUTE_MANAGE);
    const optionId = String(formData.get("optionId") ?? "");

    const inUse = await prisma.productVariantOption.count({ where: { optionId } });
    if (inUse > 0) {
      throw errors.conflict("This option is used by existing product variants and cannot be removed.");
    }

    await prisma.attributeOption.delete({ where: { id: optionId } });
    revalidatePath("/dashboard/attributes");
    return actionSuccess("Option removed.");
  } catch (error) {
    return actionFailure(error, "deleteAttributeOption");
  }
}

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

function parseSpecifications(raw: string | null): Prisma.InputJsonValue | undefined {
  if (!raw) return undefined;
  // "Label: value" per line — friendlier for shop staff than raw JSON.
  const rows = raw
    .split("\n")
    .map((line) => line.split(/:(.+)/))
    .filter((parts) => parts.length >= 2 && parts[0]?.trim() && parts[1]?.trim())
    .map((parts) => ({ label: parts[0]!.trim(), value: parts[1]!.trim() }));
  return rows.length > 0 ? rows : undefined;
}

export async function saveProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = String(formData.get("id") ?? "");
    const user = await requirePermission(id ? PERMISSIONS.PRODUCT_UPDATE : PERMISSIONS.PRODUCT_CREATE);
    const input = productSchema.parse(formDataToObject(formData));

    const slug = input.slug
      ? slugify(input.slug)
      : await uniqueSlug(input.name, async (candidate) =>
          Boolean(await prisma.product.findFirst({ where: { slug: candidate, NOT: id ? { id } : undefined }, select: { id: true } })));

    if (input.sku) {
      const clash = await prisma.product.findFirst({
        where: { sku: input.sku, NOT: id ? { id } : undefined },
        select: { id: true },
      });
      if (clash) throw errors.validation("That SKU is already in use.", { sku: "SKU already used." });
    }

    const before = id
      ? await prisma.product.findUnique({
          where: { id },
          select: { name: true, price: true, stock: true, status: true, createdById: true },
        })
      : null;

    /*
     * Ownership and approval, both enforced here rather than by which controls
     * the page rendered.
     *
     * A moderator builds the catalogue but does not decide what customers see:
     * without PRODUCT_PUBLISH their work stays a draft, and without
     * PRODUCT_MANAGE_ALL they may only touch products they created.
     */
    const canPublish = await userHasPermission(user, PERMISSIONS.PRODUCT_PUBLISH);
    const canManageAll = await userHasPermission(user, PERMISSIONS.PRODUCT_MANAGE_ALL);

    if (before && !canManageAll && before.createdById !== user.id) {
      throw errors.forbidden("You can only edit products you created.");
    }

    // Keep whatever it already was rather than silently demoting a live
    // product because a moderator edited a typo on it.
    const requestedStatus = canPublish
      ? input.status
      : input.status === "PUBLISHED"
        ? (before?.status ?? "DRAFT")
        : input.status;

    const submittedForReview = !canPublish && input.status === "PUBLISHED" && requestedStatus !== "PUBLISHED";

    const tags = input.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 30);

    const data = {
      name: input.name,
      slug,
      sku: input.sku,
      categoryId: input.categoryId,
      brandId: input.brandId,
      shortDescription: input.shortDescription,
      description: input.description,
      specifications: parseSpecifications(input.specifications),
      price: input.price,
      compareAtPrice: input.compareAtPrice,
      costPrice: input.costPrice,
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold,
      weightGrams: input.weightGrams ?? null,
      tags,
      status: requestedStatus,
      isFeatured: input.isFeatured,
      isTopSelling: input.isTopSelling,
      manualRank: input.manualRank,
      shippingMode: input.shippingMode,
      shippingFlatFee: input.shippingMode === "FIXED" ? input.shippingFlatFee : null,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      canonicalUrl: input.canonicalUrl,
      ogImageUrl: input.ogImageUrl,
      noIndex: input.noIndex,
      publishedAt: requestedStatus === "PUBLISHED" ? (before ? undefined : new Date()) : undefined,
    };

    const saved = id
      ? await prisma.product.update({ where: { id }, data })
      : await prisma.product.create({ data: { ...data, createdById: user.id, publishedAt: requestedStatus === "PUBLISHED" ? new Date() : null } });

    // Record a stock movement when an admin edits the base stock directly.
    if (before && before.stock !== input.stock) {
      await prisma.inventoryMovement.create({
        data: {
          productId: saved.id,
          type: "ADJUSTMENT",
          quantityChange: input.stock - before.stock,
          quantityAfter: input.stock,
          reason: "Stock edited on the product form",
          actorId: user.id,
        },
      });
    }

    await recordAudit({
      actor: user,
      action: submittedForReview
        ? AUDIT_ACTIONS.PRODUCT_SUBMITTED
        : id
          ? AUDIT_ACTIONS.PRODUCT_UPDATED
          : AUDIT_ACTIONS.PRODUCT_CREATED,
      entityType: "product",
      entityId: saved.id,
      summary: `${id ? "Updated" : "Created"} product “${saved.name}”`,
      before: before ?? undefined,
      after: { name: saved.name, price: saved.price, stock: saved.stock, status: saved.status },
      severity: "NOTICE",
    });

    // Someone has to know a draft is waiting, or it sits there unseen.
    if (submittedForReview) {
      await notifyStaffWithPermission(PERMISSIONS.PRODUCT_PUBLISH, {
        type: "product.review",
        title: `“${saved.name}” is waiting for review`,
        body: `${user.name} submitted it to be published.`,
        url: `/dashboard/products/${saved.id}`,
      }, user.id);
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/product/${slug}`);
    revalidatePath("/");
    return actionSuccess(
      submittedForReview
        ? "Saved as a draft and sent for review — an admin will publish it."
        : id
          ? "Product saved."
          : "Product created.",
      `/dashboard/products/${saved.id}`,
    );
  } catch (error) {
    return actionFailure(error, "saveProduct");
  }
}

export async function setProductStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCT_UPDATE);
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"].includes(status)) {
      throw errors.validation("Invalid status.");
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { createdById: true, name: true },
    });
    if (!existing) throw errors.notFound("Product not found.");

    const [canPublish, canManageAll] = await Promise.all([
      userHasPermission(user, PERMISSIONS.PRODUCT_PUBLISH),
      userHasPermission(user, PERMISSIONS.PRODUCT_MANAGE_ALL),
    ]);

    if (!canManageAll && existing.createdById !== user.id) {
      throw errors.forbidden("You can only change products you created.");
    }
    // Taking a product off the shop is as consequential as putting it on.
    if (!canPublish && (status === "PUBLISHED" || status === "UNPUBLISHED")) {
      throw errors.forbidden("Only an admin can publish or unpublish a product.");
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        status: status as "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED",
        publishedAt: status === "PUBLISHED" ? new Date() : undefined,
      },
      select: { name: true, slug: true, createdById: true },
    });

    // Let the author know their draft went live.
    if (status === "PUBLISHED" && product.createdById !== user.id) {
      await notifyMany([{
        userId: product.createdById,
        type: "product.published",
        title: `“${product.name}” is now live`,
        body: `${user.name} published the product you created.`,
        url: `/dashboard/products/${id}`,
      }]);
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.PRODUCT_UPDATED,
      entityType: "product",
      entityId: id,
      summary: `Set “${product.name}” to ${status.toLowerCase()}`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/products");
    revalidatePath(`/product/${product.slug}`);
    return actionSuccess("Status updated.");
  } catch (error) {
    return actionFailure(error, "setProductStatus");
  }
}

/**
 * Archive rather than delete: an order item may reference this product and the
 * customer's history must stay intact (PRD §10/§28).
 */
export async function archiveProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCT_DELETE);
    const id = String(formData.get("id") ?? "");

    const product = await prisma.product.update({
      where: { id },
      data: { status: "ARCHIVED", deletedAt: new Date(), isFeatured: false, isTopSelling: false },
      select: { name: true },
    });

    await prisma.cartItem.deleteMany({ where: { productId: id } });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.PRODUCT_DELETED,
      entityType: "product",
      entityId: id,
      summary: `Archived product “${product.name}”`,
      severity: "WARNING",
    });

    revalidatePath("/dashboard/products");
    return actionSuccess("Product archived.");
  } catch (error) {
    return actionFailure(error, "archiveProduct");
  }
}

/* -------------------------------------------------------------------------- */
/* Product images                                                              */
/* -------------------------------------------------------------------------- */

export async function addProductImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.PRODUCT_UPDATE);
    const productId = String(formData.get("productId") ?? "");
    const url = String(formData.get("url") ?? "").trim();
    const publicId = String(formData.get("publicId") ?? "").trim() || null;
    const alt = String(formData.get("alt") ?? "").trim() || null;

    if (!url.startsWith("https://")) throw errors.validation("Image URL must be an https address.");

    const count = await prisma.productImage.count({ where: { productId } });
    if (count >= 12) throw errors.conflict("A product can have at most 12 images.");

    await prisma.productImage.create({
      data: { productId, url, publicId, alt, position: count, isPrimary: count === 0 },
    });

    revalidatePath(`/dashboard/products/${productId}`);
    return actionSuccess("Image added.");
  } catch (error) {
    return actionFailure(error, "addProductImage");
  }
}

export async function deleteProductImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.PRODUCT_UPDATE);
    const imageId = String(formData.get("imageId") ?? "");

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      select: { productId: true, publicId: true, isPrimary: true },
    });
    if (!image) throw errors.notFound("Image not found.");

    await prisma.productImage.delete({ where: { id: imageId } });
    if (image.publicId) void destroyAsset(image.publicId);

    if (image.isPrimary) {
      const next = await prisma.productImage.findFirst({
        where: { productId: image.productId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }

    revalidatePath(`/dashboard/products/${image.productId}`);
    return actionSuccess("Image removed.");
  } catch (error) {
    return actionFailure(error, "deleteProductImage");
  }
}

export async function setPrimaryImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.PRODUCT_UPDATE);
    const imageId = String(formData.get("imageId") ?? "");
    const image = await prisma.productImage.findUnique({ where: { id: imageId }, select: { productId: true } });
    if (!image) throw errors.notFound("Image not found.");

    await prisma.$transaction([
      prisma.productImage.updateMany({ where: { productId: image.productId }, data: { isPrimary: false } }),
      prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
    ]);

    revalidatePath(`/dashboard/products/${image.productId}`);
    return actionSuccess("Primary image updated.");
  } catch (error) {
    return actionFailure(error, "setPrimaryImage");
  }
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

export async function adjustInventoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const input = inventoryAdjustSchema.parse(formDataToObject(formData));

    await prisma.$transaction(async (tx) => {
      if (input.variantId) {
        const variant = await tx.productVariant.findUnique({
          where: { id: input.variantId },
          select: { stock: true, productId: true },
        });
        if (!variant) throw errors.notFound("Variant not found.");

        const next = Math.max(0, variant.stock + input.quantityChange);
        await tx.productVariant.update({ where: { id: input.variantId }, data: { stock: next } });
        await tx.inventoryMovement.create({
          data: {
            productId: variant.productId,
            variantId: input.variantId,
            type: "ADJUSTMENT",
            quantityChange: input.quantityChange,
            quantityAfter: next,
            reason: input.reason,
            actorId: user.id,
          },
        });
      } else {
        const product = await tx.product.findUnique({ where: { id: input.productId }, select: { stock: true } });
        if (!product) throw errors.notFound("Product not found.");

        const next = Math.max(0, product.stock + input.quantityChange);
        await tx.product.update({ where: { id: input.productId }, data: { stock: next } });
        await tx.inventoryMovement.create({
          data: {
            productId: input.productId,
            type: "ADJUSTMENT",
            quantityChange: input.quantityChange,
            quantityAfter: next,
            reason: input.reason,
            actorId: user.id,
          },
        });
      }
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: "product",
      entityId: input.productId,
      summary: `Stock adjusted by ${input.quantityChange}: ${input.reason}`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/inventory");
    revalidatePath(`/dashboard/products/${input.productId}`);
    return actionSuccess("Inventory updated.");
  } catch (error) {
    return actionFailure(error, "adjustInventory");
  }
}

/* -------------------------------------------------------------------------- */
/* Related products                                                            */
/* -------------------------------------------------------------------------- */

export async function saveRelatedProductsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.PRODUCT_UPDATE);
    const productId = String(formData.get("productId") ?? "");
    const relatedIds = formDataList(formData, "relatedIds").filter((id) => id !== productId).slice(0, 12);

    await prisma.$transaction([
      prisma.relatedProduct.deleteMany({ where: { productId } }),
      prisma.relatedProduct.createMany({
        data: relatedIds.map((relatedId, index) => ({ productId, relatedId, position: index })),
        skipDuplicates: true,
      }),
    ]);

    revalidatePath(`/dashboard/products/${productId}`);
    return actionSuccess("Related products updated.");
  } catch (error) {
    return actionFailure(error, "saveRelatedProducts");
  }
}
