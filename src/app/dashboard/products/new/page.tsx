import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { EMPTY_PRODUCT, ProductForm } from "@/components/dashboard/product-form";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePermissionPage(PERMISSIONS.PRODUCT_CREATE, "/dashboard/products");

  const [categories, brands, settings] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Add product"
        description="Create the product, then add images and variants."
        action={<Link href="/dashboard/products" className="btn-ghost btn-sm">← All products</Link>}
      />
      <ProductForm
        values={EMPTY_PRODUCT}
        categories={categories}
        brands={brands}
        uploadRecommendation={settings.upload.recommendedProductImage}
      />
    </>
  );
}
