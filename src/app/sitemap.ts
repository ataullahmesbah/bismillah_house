import type { MetadataRoute } from "next";

import { prisma, safeQuery } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Dynamic sitemap built from the database (PRD §24).
 * Only indexable, published URLs are listed — never cart, checkout, account or
 * filtered listing URLs.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  if (!settings.seo.robotsIndex) return [];

  const [products, categories, brands, pages] = await Promise.all([
    safeQuery(() => prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null, noIndex: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }), [], "sitemapProducts"),
    safeQuery(() => prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
      take: 500,
    }), [], "sitemapCategories"),
    safeQuery(() => prisma.brand.findMany({
      where: { isActive: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
      take: 500,
    }), [], "sitemapBrands"),
    safeQuery(() => prisma.page.findMany({
      where: { isPublished: true, noIndex: false },
      select: { slug: true, updatedAt: true },
      take: 200,
    }), [], "sitemapPages"),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/track-order"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/help"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/faq"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.5 },
  ];

  return [
    ...staticRoutes,
    ...products.map((product) => ({
      url: absoluteUrl(`/product/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(`/category/${category.slug}`),
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...brands.map((brand) => ({
      url: absoluteUrl(`/shop?brand=${brand.slug}`),
      lastModified: brand.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...pages.map((page) => ({
      url: absoluteUrl(`/${page.slug}`),
      lastModified: page.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
