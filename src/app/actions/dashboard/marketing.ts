"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import {
  bannerSchema, couponSchema, flashSaleItemSchema, flashSaleSchema, offerSchema,
} from "@/lib/validation/commerce";
import { formDataList, formDataToObject } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { toMinor } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Coupon create/update (PRD update §1).
 * Scope, eligibility relations, schedule and limits are all persisted; the
 * checkout re-validates every one of them server-side at order time.
 */
export async function saveCouponAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COUPON_MANAGE);
    const id = String(formData.get("id") ?? "");

    const payload = {
      ...formDataToObject(formData),
      productIds: formDataList(formData, "productIds"),
      categoryIds: formDataList(formData, "categoryIds"),
      excludedProductIds: formDataList(formData, "excludedProductIds"),
    };
    const input = couponSchema.parse(payload);

    const clash = await prisma.coupon.findFirst({
      where: { code: input.code, NOT: id ? { id } : undefined },
      select: { id: true },
    });
    if (clash) throw errors.validation("That coupon code already exists.", { code: "Code already in use." });

    // PERCENT stores the whole percentage; FIXED stores minor units.
    const discountValue =
      input.discountType === "PERCENT" ? Math.round(input.discountValue) : toMinor(input.discountValue);

    const data = {
      code: input.code,
      title: input.title,
      description: input.description,
      discountType: input.discountType,
      discountValue,
      minOrderAmount: input.minOrderAmount,
      maxDiscountAmount: input.maxDiscountAmount,
      startAt: input.startAt,
      endAt: input.endAt,
      usageLimit: input.usageLimit || null,
      perCustomerLimit: input.perCustomerLimit || null,
      isActive: input.isActive,
      scope: input.scope,
      allowOnFlashSale: input.allowOnFlashSale,
      allowStacking: input.allowStacking,
    };

    const coupon = id
      ? await prisma.coupon.update({ where: { id }, data })
      : await prisma.coupon.create({ data: { ...data, createdById: user.id } });

    // Eligibility relations are replaced wholesale so the UI is the source of truth.
    await prisma.$transaction([
      prisma.couponProduct.deleteMany({ where: { couponId: coupon.id } }),
      prisma.couponCategory.deleteMany({ where: { couponId: coupon.id } }),
      prisma.couponExclusion.deleteMany({ where: { couponId: coupon.id } }),
      ...(input.scope === "PRODUCT" && input.productIds.length
        ? [prisma.couponProduct.createMany({
            data: input.productIds.map((productId) => ({ couponId: coupon.id, productId })),
            skipDuplicates: true,
          })]
        : []),
      ...(input.scope === "CATEGORY" && input.categoryIds.length
        ? [prisma.couponCategory.createMany({
            data: input.categoryIds.map((categoryId) => ({ couponId: coupon.id, categoryId })),
            skipDuplicates: true,
          })]
        : []),
      ...(input.excludedProductIds.length
        ? [prisma.couponExclusion.createMany({
            data: input.excludedProductIds.map((productId) => ({ couponId: coupon.id, productId })),
            skipDuplicates: true,
          })]
        : []),
    ]);

    await recordAudit({
      actor: user,
      action: id ? AUDIT_ACTIONS.COUPON_UPDATED : AUDIT_ACTIONS.COUPON_CREATED,
      entityType: "coupon",
      entityId: coupon.id,
      summary: `${id ? "Updated" : "Created"} coupon ${coupon.code} (${input.scope.toLowerCase()})`,
      after: data,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/coupons");
    return actionSuccess(id ? "Coupon updated." : "Coupon created.", "/dashboard/coupons");
  } catch (error) {
    return actionFailure(error, "saveCoupon");
  }
}

export async function toggleCouponAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COUPON_MANAGE);
    const id = String(formData.get("id") ?? "");
    const isActive = formData.get("isActive") === "true";

    const coupon = await prisma.coupon.update({ where: { id }, data: { isActive }, select: { code: true } });
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.COUPON_UPDATED,
      entityType: "coupon",
      entityId: id,
      summary: `${isActive ? "Enabled" : "Disabled"} coupon ${coupon.code}`,
    });

    revalidatePath("/dashboard/coupons");
    return actionSuccess(isActive ? "Coupon enabled." : "Coupon disabled.");
  } catch (error) {
    return actionFailure(error, "toggleCoupon");
  }
}

export async function archiveCouponAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COUPON_MANAGE);
    const id = String(formData.get("id") ?? "");
    const coupon = await prisma.coupon.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
      select: { code: true },
    });
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.COUPON_UPDATED,
      entityType: "coupon",
      entityId: id,
      summary: `Archived coupon ${coupon.code}`,
      severity: "NOTICE",
    });
    revalidatePath("/dashboard/coupons");
    return actionSuccess("Coupon archived.");
  } catch (error) {
    return actionFailure(error, "archiveCoupon");
  }
}

/* -------------------------------------------------------------------------- */
/* Offers (including short 2-hour campaigns)                                   */
/* -------------------------------------------------------------------------- */

export async function saveOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.OFFER_MANAGE);
    const id = String(formData.get("id") ?? "");

    const input = offerSchema.parse({
      ...formDataToObject(formData),
      productIds: formDataList(formData, "productIds"),
      categoryIds: formDataList(formData, "categoryIds"),
    });

    const discountValue =
      input.discountType === "PERCENT" ? Math.round(input.discountValue) : toMinor(input.discountValue);

    const data = {
      title: input.title,
      description: input.description,
      discountType: input.discountType,
      discountValue,
      maxDiscountAmount: input.maxDiscountAmount,
      scope: input.scope,
      startAt: input.startAt,
      endAt: input.endAt,
      isActive: input.isActive,
      priority: input.priority,
      badgeText: input.badgeText,
      showCountdown: input.showCountdown,
    };

    const offer = id
      ? await prisma.offer.update({ where: { id }, data })
      : await prisma.offer.create({ data });

    await prisma.$transaction([
      prisma.offerProduct.deleteMany({ where: { offerId: offer.id } }),
      prisma.offerCategory.deleteMany({ where: { offerId: offer.id } }),
      ...(input.scope === "PRODUCT" && input.productIds.length
        ? [prisma.offerProduct.createMany({
            data: input.productIds.map((productId) => ({ offerId: offer.id, productId })),
            skipDuplicates: true,
          })]
        : []),
      ...(input.scope === "CATEGORY" && input.categoryIds.length
        ? [prisma.offerCategory.createMany({
            data: input.categoryIds.map((categoryId) => ({ offerId: offer.id, categoryId })),
            skipDuplicates: true,
          })]
        : []),
    ]);

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.OFFER_UPDATED,
      entityType: "offer",
      entityId: offer.id,
      summary: `${id ? "Updated" : "Created"} offer “${offer.title}”`,
      after: data,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/offers");
    revalidatePath("/");
    return actionSuccess(id ? "Offer updated." : "Offer created.", "/dashboard/offers");
  } catch (error) {
    return actionFailure(error, "saveOffer");
  }
}

export async function archiveOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.OFFER_MANAGE);
    const id = String(formData.get("id") ?? "");
    await prisma.offer.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    await recordAudit({ actor: user, action: AUDIT_ACTIONS.OFFER_UPDATED, entityType: "offer", entityId: id, summary: "Archived offer" });
    revalidatePath("/dashboard/offers");
    revalidatePath("/");
    return actionSuccess("Offer archived.");
  } catch (error) {
    return actionFailure(error, "archiveOffer");
  }
}

/* -------------------------------------------------------------------------- */
/* Flash sales                                                                 */
/* -------------------------------------------------------------------------- */

export async function saveFlashSaleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.FLASH_SALE_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = flashSaleSchema.parse(formDataToObject(formData));

    const sale = id
      ? await prisma.flashSale.update({ where: { id }, data: input })
      : await prisma.flashSale.create({ data: input });

    await recordAudit({
      actor: user,
      action: "flash_sale.saved",
      entityType: "flash_sale",
      entityId: sale.id,
      summary: `${id ? "Updated" : "Created"} flash sale “${sale.title}”`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/flash-sales");
    revalidatePath("/");
    return actionSuccess(id ? "Flash sale updated." : "Flash sale created.", `/dashboard/flash-sales/${sale.id}`);
  } catch (error) {
    return actionFailure(error, "saveFlashSale");
  }
}

export async function addFlashSaleItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.FLASH_SALE_MANAGE);
    const input = flashSaleItemSchema.parse(formDataToObject(formData));

    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { price: true, name: true },
    });
    if (!product) throw errors.notFound("Product not found.");
    if (input.salePrice >= product.price) {
      throw errors.validation("The sale price must be lower than the current price.", { salePrice: "Too high." });
    }

    const count = await prisma.flashSaleItem.count({ where: { flashSaleId: input.flashSaleId } });

    // variantId is nullable, so the compound unique cannot be used in `upsert`.
    const existing = await prisma.flashSaleItem.findFirst({
      where: {
        flashSaleId: input.flashSaleId,
        productId: input.productId,
        variantId: input.variantId,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.flashSaleItem.update({
        where: { id: existing.id },
        data: { salePrice: input.salePrice, stockLimit: input.stockLimit ?? null },
      });
    } else {
      await prisma.flashSaleItem.create({
        data: {
          flashSaleId: input.flashSaleId,
          productId: input.productId,
          variantId: input.variantId,
          salePrice: input.salePrice,
          stockLimit: input.stockLimit ?? null,
          position: count,
        },
      });
    }

    await recordAudit({
      actor: user,
      action: "flash_sale.item.saved",
      entityType: "flash_sale",
      entityId: input.flashSaleId,
      summary: `Added “${product.name}” to a flash sale`,
    });

    revalidatePath(`/dashboard/flash-sales/${input.flashSaleId}`);
    revalidatePath("/");
    return actionSuccess("Product added to the flash sale.");
  } catch (error) {
    return actionFailure(error, "addFlashSaleItem");
  }
}

export async function removeFlashSaleItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.FLASH_SALE_MANAGE);
    const itemId = String(formData.get("itemId") ?? "");
    const item = await prisma.flashSaleItem.delete({ where: { id: itemId }, select: { flashSaleId: true } });
    revalidatePath(`/dashboard/flash-sales/${item.flashSaleId}`);
    revalidatePath("/");
    return actionSuccess("Removed from the flash sale.");
  } catch (error) {
    return actionFailure(error, "removeFlashSaleItem");
  }
}

/* -------------------------------------------------------------------------- */
/* Banners & ads                                                               */
/* -------------------------------------------------------------------------- */

export async function saveBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BANNER_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = bannerSchema.parse(formDataToObject(formData));

    const banner = id
      ? await prisma.banner.update({ where: { id }, data: input })
      : await prisma.banner.create({ data: input });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.BANNER_UPDATED,
      entityType: "banner",
      entityId: banner.id,
      summary: `${id ? "Updated" : "Created"} ${input.placement} banner “${banner.title}”`,
    });

    revalidatePath("/dashboard/banners");
    revalidatePath("/");
    return actionSuccess(id ? "Banner updated." : "Banner created.");
  } catch (error) {
    return actionFailure(error, "saveBanner");
  }
}

export async function deleteBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BANNER_MANAGE);
    const id = String(formData.get("id") ?? "");
    await prisma.banner.delete({ where: { id } });
    await recordAudit({ actor: user, action: AUDIT_ACTIONS.BANNER_UPDATED, entityType: "banner", entityId: id, summary: "Deleted banner" });
    revalidatePath("/dashboard/banners");
    revalidatePath("/");
    return actionSuccess("Banner deleted.");
  } catch (error) {
    return actionFailure(error, "deleteBanner");
  }
}
