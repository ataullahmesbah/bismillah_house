import "server-only";

import { prisma } from "@/lib/db";

/** Option lists shared by the coupon, offer and flash-sale editors. */

export async function getProductOptions(limit = 500) {
  const products = await prisma.product.findMany({
    where: { deletedAt: null, status: { in: ["PUBLISHED", "DRAFT"] } },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, sku: true, price: true, category: { select: { name: true } } },
  });
  return products.map((product) => ({
    id: product.id,
    label: product.name,
    hint: [product.sku, product.category?.name].filter(Boolean).join(" · ") || undefined,
    price: product.price,
  }));
}

export async function getCategoryOptions() {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  return categories.map((category) => ({
    id: category.id,
    label: category.name,
    hint: category.parent?.name ? `in ${category.parent.name}` : undefined,
  }));
}
