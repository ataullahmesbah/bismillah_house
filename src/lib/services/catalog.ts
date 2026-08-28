import "server-only";

import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { optimizedImage } from "@/lib/cloudinary";
import type {
  FlashSaleItemPricing, OfferPricing, ProductPricing, VariantPricing,
} from "./pricing";

/**
 * Shared catalogue loaders.
 *
 * The pricing context (active flash sales + offers) is loaded once per request
 * and reused by the cart, product pages and checkout so a listing page never
 * issues one query per product.
 */

export type PricingContext = {
  flashSaleItems: FlashSaleItemPricing[];
  offers: OfferPricing[];
  now: Date;
};

export const getPricingContext = cache(async (): Promise<PricingContext> => {
  const now = new Date();

  const [flashSaleItems, offers] = await Promise.all([
    safeQuery(() => prisma.flashSaleItem.findMany({
      where: {
        flashSale: { isActive: true, startAt: { lte: now }, endAt: { gt: now } },
      },
      select: {
        id: true, flashSaleId: true, productId: true, variantId: true,
        salePrice: true, stockLimit: true, soldCount: true,
        flashSale: { select: { startAt: true, endAt: true, title: true } },
      },
    }), [], "flashSaleItems"),
    safeQuery(() => prisma.offer.findMany({
      where: { isActive: true, deletedAt: null, startAt: { lte: now }, endAt: { gt: now } },
      select: {
        id: true, title: true, discountType: true, discountValue: true, maxDiscountAmount: true,
        scope: true, startAt: true, endAt: true, priority: true, badgeText: true, showCountdown: true,
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
      orderBy: { priority: "desc" },
    }), [], "offers"),
  ]);

  return {
    now,
    flashSaleItems: flashSaleItems.map((item) => ({
      id: item.id,
      flashSaleId: item.flashSaleId,
      productId: item.productId,
      variantId: item.variantId,
      salePrice: item.salePrice,
      stockLimit: item.stockLimit,
      soldCount: item.soldCount,
      startAt: item.flashSale.startAt,
      endAt: item.flashSale.endAt,
      title: item.flashSale.title,
    })),
    offers: offers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      maxDiscountAmount: offer.maxDiscountAmount,
      scope: offer.scope,
      startAt: offer.startAt,
      endAt: offer.endAt,
      priority: offer.priority,
      badgeText: offer.badgeText,
      showCountdown: offer.showCountdown,
      productIds: offer.products.map((row) => row.productId),
      categoryIds: offer.categories.map((row) => row.categoryId),
    })),
  };
});

/** Columns every storefront product card needs — nothing more leaves the DB. */
export const PRODUCT_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  stock: true,
  hasVariants: true,
  categoryId: true,
  shippingMode: true,
  shippingFlatFee: true,
  ratingAverage: true,
  ratingCount: true,
  soldCount: true,
  status: true,
  images: {
    select: { url: true, alt: true },
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
    take: 1,
  },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

export type ProductCardRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  hasVariants: boolean;
  categoryId: string | null;
  shippingMode: "STANDARD" | "FREE" | "FIXED";
  shippingFlatFee: number | null;
  ratingAverage: number;
  ratingCount: number;
  soldCount: number;
  images: Array<{ url: string; alt: string | null }>;
  category?: { name: string; slug: string } | null;
};

/** Serialisable card model handed to client components. */
export type ProductCardModel = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  imageAlt: string;
  listPrice: number;
  unitPrice: number;
  compareAtPrice: number | null;
  stock: number;
  hasVariants: boolean;
  inStock: boolean;
  rating: number;
  ratingCount: number;
  categoryName: string | null;
  badge: string | null;
  flashEndsAt: string | null;
  shippingMode: "STANDARD" | "FREE" | "FIXED";
};

export function toProductPricing(row: ProductCardRow): ProductPricing {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    categoryId: row.categoryId,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    stock: row.stock,
    hasVariants: row.hasVariants,
    shippingMode: row.shippingMode,
    shippingFlatFee: row.shippingFlatFee,
    imageUrl: row.images[0]?.url ?? null,
  };
}

export function toVariantPricing(variant: {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
  options?: Array<{ attribute: { name: string }; option: { label: string } }>;
}): VariantPricing {
  return {
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    stock: variant.stock,
    isActive: variant.isActive,
    imageUrl: variant.imageUrl,
    attributes: variant.options?.map((row) => ({
      attribute: row.attribute.name,
      value: row.option.label,
    })),
  };
}

/** Builds the display model for a grid of products, applying live campaigns. */
export async function buildProductCards(rows: ProductCardRow[]): Promise<ProductCardModel[]> {
  const { flashSaleItems, offers, now } = await getPricingContext();
  const { resolveUnitPrice } = await import("./pricing");

  return rows.map((row) => {
    const product = toProductPricing(row);
    const price = resolveUnitPrice(product, null, flashSaleItems, offers, now);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      imageUrl: optimizedImage(row.images[0]?.url ?? null, 600),
      imageAlt: row.images[0]?.alt ?? row.name,
      listPrice: price.listPrice,
      unitPrice: price.unitPrice,
      compareAtPrice: price.compareAtPrice,
      stock: row.stock,
      hasVariants: row.hasVariants,
      inStock: row.stock > 0,
      rating: row.ratingAverage,
      ratingCount: row.ratingCount,
      categoryName: row.category?.name ?? null,
      badge:
        price.source === "FLASH_SALE"
          ? "Flash Sale"
          : price.source === "OFFER"
            ? (price.offerBadge ?? "Offer")
            : null,
      flashEndsAt: price.flashSaleEndsAt?.toISOString() ?? price.offerEndsAt?.toISOString() ?? null,
      shippingMode: row.shippingMode,
    };
  });
}

/** Active delivery districts, cached per request. */
export const getDistricts = cache(async () => {
  return safeQuery(() => prisma.district.findMany({
    where: { isActive: true },
    orderBy: [{ division: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, nameBn: true, division: true,
      deliveryCharge: true, isFreeDelivery: true, isActive: true, estimatedDays: true,
    },
  }), [], "districts");
});

/** Category tree for menus and filters. */
export const getCategoryTree = cache(async () => {
  const categories = await safeQuery(() => prisma.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, slug: true, parentId: true, imageUrl: true,
      iconName: true, showInMenu: true, isFeatured: true,
      _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } },
    },
  }), [], "categoryTree");

  const byParent = new Map<string | null, typeof categories>();
  for (const category of categories) {
    const key = category.parentId;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(category);
    else byParent.set(key, [category]);
  }

  return {
    all: categories,
    roots: byParent.get(null) ?? [],
    childrenOf: (parentId: string) => byParent.get(parentId) ?? [],
  };
});
