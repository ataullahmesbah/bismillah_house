import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZES } from "@/lib/constants";
import { optimizedImage } from "@/lib/cloudinary";
import { buildProductCards, PRODUCT_CARD_SELECT, getPricingContext, toProductPricing, toVariantPricing, type ProductCardModel } from "./catalog";
import { resolveUnitPrice, type ResolvedPrice } from "./pricing";

/** Storefront product search, filtering and sorting — all done in the database. */

export type ProductSort = "relevance" | "newest" | "price_asc" | "price_desc" | "popular" | "rating" | "featured";

export type ProductQuery = {
  q?: string;
  categorySlug?: string;
  brandSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
};

export type ProductSearchResult = {
  products: ProductCardModel[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: {
    categories: Array<{ id: string; name: string; slug: string; count: number }>;
    brands: Array<{ id: string; name: string; slug: string; count: number }>;
    priceRange: { min: number; max: number };
  };
};

function orderByFor(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc": return [{ price: "asc" }, { name: "asc" }];
    case "price_desc": return [{ price: "desc" }, { name: "asc" }];
    case "popular": return [{ soldCount: "desc" }, { viewCount: "desc" }];
    case "rating": return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "featured": return [{ isFeatured: "desc" }, { manualRank: "desc" }, { createdAt: "desc" }];
    case "newest":
    case "relevance":
    default: return [{ publishedAt: "desc" }, { createdAt: "desc" }];
  }
}

export async function searchProducts(query: ProductQuery): Promise<ProductSearchResult> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(60, Math.max(1, query.perPage ?? PAGE_SIZES.storefront));

  // Category filter includes the whole subtree so a parent page shows children.
  let categoryIds: string[] | undefined;
  if (query.categorySlug) {
    const category = await prisma.category.findFirst({
      where: { slug: query.categorySlug, isActive: true, deletedAt: null },
      select: { id: true, children: { select: { id: true } } },
    });
    categoryIds = category ? [category.id, ...category.children.map((child) => child.id)] : ["__none__"];
  }

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(query.brandSlug ? { brand: { slug: query.brandSlug } } : {}),
    ...(query.inStockOnly ? { stock: { gt: 0 } } : {}),
    ...(query.onSaleOnly ? { compareAtPrice: { not: null } } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? { price: { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { shortDescription: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
            { sku: { contains: query.q, mode: "insensitive" } },
            { tags: { has: query.q.toLowerCase() } },
            { category: { name: { contains: query.q, mode: "insensitive" } } },
            { brand: { name: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total, categoryFacets, brandFacets, priceAggregate] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: orderByFor(query.sort ?? "newest"),
      skip: (page - 1) * perPage,
      take: perPage,
      select: PRODUCT_CARD_SELECT,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null, products: { some: { status: "PUBLISHED", deletedAt: null } } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      take: 40,
      select: {
        id: true, name: true, slug: true,
        _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } },
      },
    }),
    prisma.brand.findMany({
      where: { isActive: true, deletedAt: null, products: { some: { status: "PUBLISHED", deletedAt: null } } },
      orderBy: { name: "asc" },
      take: 30,
      select: {
        id: true, name: true, slug: true,
        _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } },
      },
    }),
    prisma.product.aggregate({
      where: { status: "PUBLISHED", deletedAt: null },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return {
    products: await buildProductCards(rows),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    facets: {
      categories: categoryFacets.map((row) => ({ id: row.id, name: row.name, slug: row.slug, count: row._count.products })),
      brands: brandFacets.map((row) => ({ id: row.id, name: row.name, slug: row.slug, count: row._count.products })),
      priceRange: { min: priceAggregate._min.price ?? 0, max: priceAggregate._max.price ?? 0 },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Product detail                                                              */
/* -------------------------------------------------------------------------- */

export type ProductDetailVariant = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unitPrice: number;
  compareAtPrice: number | null;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
  optionIds: string[];
  badge: string | null;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  specifications: Array<{ label: string; value: string }>;
  images: Array<{ url: string; alt: string }>;
  price: ResolvedPrice;
  stock: number;
  hasVariants: boolean;
  lowStockThreshold: number;
  shippingMode: "STANDARD" | "FREE" | "FIXED";
  shippingFlatFee: number | null;
  weightGrams: number | null;
  tags: string[];
  ratingAverage: number;
  ratingCount: number;
  soldCount: number;
  category: { id: string; name: string; slug: string; parent: { name: string; slug: string } | null } | null;
  brand: { name: string; slug: string } | null;
  attributes: Array<{
    id: string;
    name: string;
    type: string;
    unit: string | null;
    options: Array<{ id: string; label: string; value: string; colorHex: string | null }>;
  }>;
  variants: ProductDetailVariant[];
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  noIndex: boolean;
};

function parseSpecifications(value: unknown): Array<{ label: string; value: string }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((row): row is { label: string; value: string } =>
        Boolean(row && typeof row === "object" && "label" in row && "value" in row))
      .map((row) => ({ label: String(row.label), value: String(row.value) }));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([label, val]) => ({
      label,
      value: String(val),
    }));
  }
  return [];
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    select: {
      id: true, name: true, slug: true, sku: true, shortDescription: true, description: true,
      specifications: true, price: true, compareAtPrice: true, stock: true, hasVariants: true,
      lowStockThreshold: true, shippingMode: true, shippingFlatFee: true, weightGrams: true,
      tags: true, ratingAverage: true, ratingCount: true, soldCount: true, categoryId: true,
      seoTitle: true, seoDescription: true, canonicalUrl: true, ogImageUrl: true, noIndex: true,
      images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }], select: { url: true, alt: true } },
      category: { select: { id: true, name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      brand: { select: { name: true, slug: true } },
      productAttributes: {
        orderBy: { position: "asc" },
        select: {
          attribute: {
            select: {
              id: true, name: true, type: true, unit: true,
              options: { orderBy: { position: "asc" }, select: { id: true, label: true, value: true, colorHex: true } },
            },
          },
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: {
          id: true, name: true, sku: true, price: true, compareAtPrice: true, stock: true,
          isActive: true, imageUrl: true,
          options: { select: { optionId: true, attribute: { select: { name: true } }, option: { select: { label: true } } } },
        },
      },
    },
  });

  if (!product) return null;

  const { flashSaleItems, offers, now } = await getPricingContext();
  const pricingProduct = toProductPricing({
    ...product,
    shippingMode: product.shippingMode,
    images: product.images,
  });

  // Only the options actually used by an active variant are offered, so an
  // impossible combination can never be selected.
  const usedOptionIds = new Set(product.variants.flatMap((variant) => variant.options.map((row) => row.optionId)));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription,
    description: product.description,
    specifications: parseSpecifications(product.specifications),
    images: product.images.map((image) => ({
      url: optimizedImage(image.url, 1000) ?? image.url,
      alt: image.alt ?? product.name,
    })),
    price: resolveUnitPrice(pricingProduct, null, flashSaleItems, offers, now),
    stock: product.stock,
    hasVariants: product.hasVariants,
    lowStockThreshold: product.lowStockThreshold,
    shippingMode: product.shippingMode,
    shippingFlatFee: product.shippingFlatFee,
    weightGrams: product.weightGrams,
    tags: product.tags,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    soldCount: product.soldCount,
    category: product.category,
    brand: product.brand,
    attributes: product.productAttributes
      .map((row) => ({
        id: row.attribute.id,
        name: row.attribute.name,
        type: row.attribute.type,
        unit: row.attribute.unit,
        options: row.attribute.options.filter((option) => usedOptionIds.size === 0 || usedOptionIds.has(option.id)),
      }))
      .filter((attribute) => attribute.options.length > 0),
    variants: product.variants.map((variant) => {
      const price = resolveUnitPrice(
        pricingProduct,
        toVariantPricing({ ...variant, options: variant.options }),
        flashSaleItems,
        offers,
        now,
      );
      return {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: price.listPrice,
        unitPrice: price.unitPrice,
        compareAtPrice: variant.compareAtPrice,
        stock: variant.stock,
        isActive: variant.isActive,
        imageUrl: optimizedImage(variant.imageUrl, 1000),
        optionIds: variant.options.map((row) => row.optionId),
        badge: price.source === "FLASH_SALE" ? "Flash Sale" : price.source === "OFFER" ? (price.offerBadge ?? "Offer") : null,
      };
    }),
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    canonicalUrl: product.canonicalUrl,
    ogImageUrl: product.ogImageUrl,
    noIndex: product.noIndex,
  };
}

export async function getRelatedProducts(productId: string, categoryId: string | null, limit = 8) {
  const manual = await prisma.relatedProduct.findMany({
    where: { productId },
    orderBy: { position: "asc" },
    take: limit,
    select: { related: { select: PRODUCT_CARD_SELECT } },
  });

  const manualProducts = manual.map((row) => row.related).filter((row) => row.status === "PUBLISHED");
  if (manualProducts.length >= limit) return buildProductCards(manualProducts.slice(0, limit));

  const fill = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      id: { not: productId, notIn: manualProducts.map((row) => row.id) },
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { soldCount: "desc" },
    take: limit - manualProducts.length,
    select: PRODUCT_CARD_SELECT,
  });

  return buildProductCards([...manualProducts, ...fill]);
}

/** Approved reviews for a product page. */
export async function getProductReviews(productId: string, take = 10) {
  return prisma.review.findMany({
    where: { productId, status: "APPROVED", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, rating: true, title: true, body: true, images: true, createdAt: true,
      isVerifiedPurchase: true, authorName: true, reply: true, repliedAt: true,
      user: { select: { name: true } },
    },
  });
}

/** Non-blocking view counter used for "popular" sorting. */
export async function incrementProductView(productId: string): Promise<void> {
  await prisma.product
    .update({ where: { id: productId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}
