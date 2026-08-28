"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { formDataList } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { cartesian } from "@/lib/utils";
import { generateSku } from "@/lib/ids";
import { toMinor } from "@/lib/money";

/**
 * ADVANCED PRODUCT VARIANTS (PRD update §5)
 *
 * A product declares which reusable attributes it uses (Size, Colour, Weight,
 * Volume, Shoe Size…), then the matrix of combinations is generated in one go
 * rather than being typed out by hand. Each combination is a real
 * ProductVariant row with its own SKU, price, stock and image.
 */

/** Sets which attributes drive this product's variant matrix. */
export async function setProductAttributesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTRIBUTE_MANAGE);
    const productId = String(formData.get("productId") ?? "");
    const attributeIds = formDataList(formData, "attributeIds").slice(0, 6);

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
    if (!product) throw errors.notFound("Product not found.");

    // Removing an attribute that existing variants depend on would orphan them.
    const existingVariants = await prisma.productVariant.count({ where: { productId } });
    if (existingVariants > 0) {
      const used = await prisma.productVariantOption.findMany({
        where: { variant: { productId } },
        select: { attributeId: true },
        distinct: ["attributeId"],
      });
      const missing = used.filter((row) => !attributeIds.includes(row.attributeId));
      if (missing.length > 0) {
        throw errors.conflict("Delete the existing variants before removing an attribute they use.");
      }
    }

    await prisma.$transaction([
      prisma.productAttribute.deleteMany({ where: { productId, attributeId: { notIn: attributeIds.length ? attributeIds : ["__none__"] } } }),
      ...attributeIds.map((attributeId, index) =>
        prisma.productAttribute.upsert({
          where: { productId_attributeId: { productId, attributeId } },
          create: { productId, attributeId, position: index },
          update: { position: index },
        }),
      ),
      prisma.product.update({ where: { id: productId }, data: { hasVariants: attributeIds.length > 0 } }),
    ]);

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.PRODUCT_UPDATED,
      entityType: "product",
      entityId: productId,
      summary: `Variant attributes updated for “${product.name}”`,
    });

    revalidatePath(`/dashboard/products/${productId}/variants`);
    return actionSuccess("Variant attributes saved.");
  } catch (error) {
    return actionFailure(error, "setProductAttributes");
  }
}

/**
 * Generates every missing combination of the selected option values.
 * Existing variants are left untouched, so regenerating after adding one new
 * colour only creates the genuinely new rows.
 */
export async function generateVariantsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTRIBUTE_MANAGE);
    const productId = String(formData.get("productId") ?? "");
    const basePrice = toMinor(Number(formData.get("basePrice") ?? 0));
    const baseStock = Math.max(0, Number(formData.get("baseStock") ?? 0) || 0);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, name: true, sku: true, price: true,
        productAttributes: {
          orderBy: { position: "asc" },
          select: { attributeId: true, attribute: { select: { name: true } } },
        },
        variants: { select: { options: { select: { optionId: true } } } },
      },
    });
    if (!product) throw errors.notFound("Product not found.");
    if (product.productAttributes.length === 0) {
      throw errors.validation("Choose at least one attribute before generating variants.");
    }

    // Only the option values the admin ticked for this product.
    const selectedByAttribute = product.productAttributes.map((row) => ({
      attributeId: row.attributeId,
      attributeName: row.attribute.name,
      optionIds: formDataList(formData, `options_${row.attributeId}`),
    }));

    if (selectedByAttribute.some((group) => group.optionIds.length === 0)) {
      throw errors.validation("Select at least one option for every attribute.");
    }

    const options = await prisma.attributeOption.findMany({
      where: { id: { in: selectedByAttribute.flatMap((group) => group.optionIds) } },
      select: { id: true, label: true, attributeId: true },
    });
    const optionById = new Map(options.map((option) => [option.id, option]));

    const combinations = cartesian(selectedByAttribute.map((group) => group.optionIds));
    if (combinations.length > 300) {
      throw errors.validation(`That would create ${combinations.length} variants. The limit is 300.`);
    }

    // Signature of every combination that already exists.
    const existingKeys = new Set(
      product.variants.map((variant) => variant.options.map((row) => row.optionId).sort().join("|")),
    );

    const price = basePrice > 0 ? basePrice : product.price;
    let created = 0;
    let position = product.variants.length;

    for (const combination of combinations) {
      const key = [...combination].sort().join("|");
      if (existingKeys.has(key)) continue;

      const labels = combination.map((optionId) => optionById.get(optionId)?.label ?? "").filter(Boolean);
      const name = labels.join(" / ");
      const sku = generateSku([product.sku ?? product.name, ...labels]);

      await prisma.productVariant.create({
        data: {
          productId,
          name,
          sku: (await prisma.productVariant.findUnique({ where: { sku }, select: { id: true } })) ? `${sku}-${position}` : sku,
          price,
          stock: baseStock,
          position: position++,
          options: {
            create: combination.map((optionId) => ({
              attributeId: optionById.get(optionId)?.attributeId ?? "",
              optionId,
            })),
          },
        },
      });
      created += 1;
    }

    await prisma.product.update({ where: { id: productId }, data: { hasVariants: true } });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.PRODUCT_UPDATED,
      entityType: "product",
      entityId: productId,
      summary: `Generated ${created} variant(s) for “${product.name}”`,
      severity: "NOTICE",
    });

    revalidatePath(`/dashboard/products/${productId}/variants`);
    return actionSuccess(
      created === 0 ? "All those combinations already exist." : `${created} variant(s) created.`,
    );
  } catch (error) {
    return actionFailure(error, "generateVariants");
  }
}

/** Saves per-variant price, stock, SKU and image from the matrix editor. */
export async function saveVariantsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTRIBUTE_MANAGE);
    const productId = String(formData.get("productId") ?? "");
    const variantIds = formDataList(formData, "variantIds");

    const owned = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, productId },
      select: { id: true, stock: true },
    });
    const ownedById = new Map(owned.map((variant) => [variant.id, variant]));

    for (const variantId of variantIds) {
      const existing = ownedById.get(variantId);
      if (!existing) continue; // silently skip ids that are not this product's

      const price = toMinor(Number(formData.get(`price_${variantId}`) ?? 0));
      const compareRaw = String(formData.get(`compareAtPrice_${variantId}`) ?? "").trim();
      const stock = Math.max(0, Number(formData.get(`stock_${variantId}`) ?? 0) || 0);
      const sku = String(formData.get(`sku_${variantId}`) ?? "").trim() || null;
      const imageUrl = String(formData.get(`imageUrl_${variantId}`) ?? "").trim() || null;
      const lowStockThreshold = Math.max(0, Number(formData.get(`lowStockThreshold_${variantId}`) ?? 5) || 0);
      const isActive = formData.get(`isActive_${variantId}`) === "on";

      if (price <= 0) throw errors.validation(`Enter a price for every variant.`);

      if (sku) {
        const clash = await prisma.productVariant.findFirst({
          where: { sku, NOT: { id: variantId } },
          select: { id: true },
        });
        if (clash) throw errors.validation(`SKU “${sku}” is already used by another variant.`);
      }

      await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          price,
          compareAtPrice: compareRaw ? toMinor(Number(compareRaw)) : null,
          stock,
          lowStockThreshold,
          sku,
          imageUrl,
          isActive,
        },
      });

      if (existing.stock !== stock) {
        await prisma.inventoryMovement.create({
          data: {
            productId,
            variantId,
            type: "ADJUSTMENT",
            quantityChange: stock - existing.stock,
            quantityAfter: stock,
            reason: "Variant stock edited",
            actorId: user.id,
          },
        });
      }
    }

    // Keep the product's headline price aligned with its cheapest live variant.
    const cheapest = await prisma.productVariant.findFirst({
      where: { productId, isActive: true },
      orderBy: { price: "asc" },
      select: { price: true },
    });
    const totalStock = await prisma.productVariant.aggregate({
      where: { productId, isActive: true },
      _sum: { stock: true },
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        price: cheapest?.price ?? undefined,
        stock: totalStock._sum.stock ?? 0,
        hasVariants: true,
      },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.PRODUCT_UPDATED,
      entityType: "product",
      entityId: productId,
      summary: `Updated ${variantIds.length} variant(s)`,
    });

    revalidatePath(`/dashboard/products/${productId}/variants`);
    return actionSuccess("Variants saved.");
  } catch (error) {
    return actionFailure(error, "saveVariants");
  }
}

export async function deleteVariantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.ATTRIBUTE_MANAGE);
    const variantId = String(formData.get("variantId") ?? "");

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { productId: true, _count: { select: { orderItems: true } } },
    });
    if (!variant) throw errors.notFound("Variant not found.");

    if (variant._count.orderItems > 0) {
      // Historic orders reference it — deactivate instead of deleting.
      await prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false, stock: 0 } });
      revalidatePath(`/dashboard/products/${variant.productId}/variants`);
      return actionSuccess("This variant has orders, so it was deactivated instead of deleted.");
    }

    await prisma.productVariant.delete({ where: { id: variantId } });

    const remaining = await prisma.productVariant.count({ where: { productId: variant.productId } });
    if (remaining === 0) {
      await prisma.product.update({ where: { id: variant.productId }, data: { hasVariants: false } });
    }

    revalidatePath(`/dashboard/products/${variant.productId}/variants`);
    return actionSuccess("Variant deleted.");
  } catch (error) {
    return actionFailure(error, "deleteVariant");
  }
}
