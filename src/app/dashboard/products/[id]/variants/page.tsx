import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { VariantManager } from "@/components/dashboard/variant-manager";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ProductVariantsPage({ params }: { params: Params }) {
  const { id } = await params;
  await requirePermissionPage(PERMISSIONS.ATTRIBUTE_MANAGE, "/dashboard/products");

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true, name: true, price: true,
      productAttributes: { orderBy: { position: "asc" }, select: { attributeId: true } },
      variants: {
        orderBy: { position: "asc" },
        select: {
          id: true, name: true, sku: true, price: true, compareAtPrice: true, stock: true,
          lowStockThreshold: true, imageUrl: true, isActive: true,
          options: { select: { optionId: true } },
          _count: { select: { orderItems: true } },
        },
      },
    },
  });

  if (!product) notFound();

  const attributes = await prisma.attribute.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: {
      id: true, name: true, unit: true, type: true,
      options: { orderBy: { position: "asc" }, select: { id: true, label: true, value: true, colorHex: true } },
    },
  });

  return (
    <>
      <PageHeader
        title={`Variants — ${product.name}`}
        description="Create any combination of size, colour, weight, volume, pack or your own attributes."
        action={<Link href={`/dashboard/products/${product.id}`} className="btn-ghost btn-sm">← Back to product</Link>}
      />

      <VariantManager
        productId={product.id}
        productName={product.name}
        basePrice={product.price}
        attributes={attributes}
        selectedAttributeIds={product.productAttributes.map((row) => row.attributeId)}
        variants={product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          stock: variant.stock,
          lowStockThreshold: variant.lowStockThreshold,
          imageUrl: variant.imageUrl,
          isActive: variant.isActive,
          optionIds: variant.options.map((row) => row.optionId),
          orderCount: variant._count.orderItems,
        }))}
      />
    </>
  );
}
