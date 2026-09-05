import "server-only";

import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";
import { buildProductCards, PRODUCT_CARD_SELECT, type ProductCardModel } from "./catalog";

/**
 * Homepage composition. Which sections appear, in what order, with what
 * heading, is stored in `home_sections` and edited from the dashboard.
 */

export type HomeSectionData = {
  id: string;
  key: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  config: Record<string, unknown>;
};

export const getHomeSections = cache(async (): Promise<HomeSectionData[]> => {
  const sections = await safeQuery(() => prisma.homeSection.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: { id: true, key: true, type: true, title: true, subtitle: true, config: true },
  }), [], "homeSections");
  return sections.map((section) => ({
    ...section,
    config: (section.config ?? {}) as Record<string, unknown>,
  }));
});

function limitFrom(config: Record<string, unknown>, fallback: number): number {
  const value = Number(config.limit);
  return Number.isFinite(value) && value > 0 && value <= 48 ? Math.floor(value) : fallback;
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardModel[]> {
  const rows = await safeQuery(() => prisma.product.findMany({
    where: { status: "PUBLISHED", deletedAt: null, isFeatured: true },
    orderBy: [{ manualRank: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: PRODUCT_CARD_SELECT,
  }), [], "featuredProducts");
  return buildProductCards(rows);
}

export async function getTopSellingProducts(limit = 8): Promise<ProductCardModel[]> {
  const rows = await safeQuery(() => prisma.product.findMany({
    where: { status: "PUBLISHED", deletedAt: null, OR: [{ isTopSelling: true }, { soldCount: { gt: 0 } }] },
    orderBy: [{ isTopSelling: "desc" }, { manualRank: "desc" }, { soldCount: "desc" }],
    take: limit,
    select: PRODUCT_CARD_SELECT,
  }), [], "topSelling");
  return buildProductCards(rows);
}

export async function getNewArrivals(limit = 8): Promise<ProductCardModel[]> {
  const rows = await safeQuery(() => prisma.product.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: PRODUCT_CARD_SELECT,
  }), [], "newArrivals");
  return buildProductCards(rows);
}

export type ActiveFlashSale = {
  id: string;
  title: string;
  description: string | null;
  endAt: string;
  products: ProductCardModel[];
};

export const getActiveFlashSale = cache(async (): Promise<ActiveFlashSale | null> => {
  const now = new Date();
  const sale = await safeQuery(() => prisma.flashSale.findFirst({
    where: { isActive: true, startAt: { lte: now }, endAt: { gt: now } },
    orderBy: [{ position: "asc" }, { endAt: "asc" }],
    select: {
      id: true, title: true, description: true, endAt: true,
      items: {
        orderBy: { position: "asc" },
        take: 12,
        select: { product: { select: PRODUCT_CARD_SELECT } },
      },
    },
  }), null, "activeFlashSale");
  if (!sale || sale.items.length === 0) return null;

  const published = sale.items
    .map((item) => item.product)
    .filter((product) => product && product.status === "PUBLISHED");

  return {
    id: sale.id,
    title: sale.title,
    description: sale.description,
    endAt: sale.endAt.toISOString(),
    products: await buildProductCards(published),
  };
});

/**
 * Top-level categories for the homepage grid, each counting everything beneath
 * it.
 *
 * A shop files its products on the leaves — a phone goes in Mobile & Gadgets,
 * not in Electronics — so counting only direct children would print "0 items"
 * on a tile that opens a page listing twelve.
 */
export const getFeaturedCategories = cache(async (limit = 10) => {
  const categories = await safeQuery(() => prisma.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ isFeatured: "desc" }, { position: "asc" }],
    select: {
      id: true, name: true, slug: true, parentId: true, imageUrl: true, iconName: true,
      _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } },
    },
  }), [], "featuredCategories");

  const childrenOf = new Map<string, typeof categories>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const bucket = childrenOf.get(category.parentId);
    if (bucket) bucket.push(category);
    else childrenOf.set(category.parentId, [category]);
  }

  const rollUp = (category: (typeof categories)[number]): number =>
    category._count.products +
    (childrenOf.get(category.id) ?? []).reduce((total, child) => total + rollUp(child), 0);

  return categories
    .filter((category) => category.parentId === null)
    .slice(0, limit)
    .map((category) => ({ ...category, productCount: rollUp(category) }));
});

export const getTestimonials = cache(async (limit = 6) => {
  return safeQuery(() => prisma.testimonial.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    take: limit,
    select: { id: true, name: true, role: true, avatarUrl: true, rating: true, body: true },
  }), [], "testimonials");
});

/** Resolves the product list a configurable section should render. */
export async function resolveSectionProducts(section: HomeSectionData): Promise<ProductCardModel[]> {
  const limit = limitFrom(section.config, 8);
  switch (section.type) {
    case "FEATURED_PRODUCTS": return getFeaturedProducts(limit);
    case "TOP_SELLING": return getTopSellingProducts(limit);
    case "NEW_ARRIVALS": return getNewArrivals(limit);
    default: return [];
  }
}
