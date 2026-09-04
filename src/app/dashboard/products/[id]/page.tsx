import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, StatusPill } from "@/components/ui";
import { ProductForm, type ProductFormValues } from "@/components/dashboard/product-form";
import {
  InventoryAdjustForm, ProductGalleryManager, RelatedProductsForm,
} from "@/components/dashboard/product-media";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;
  await requirePermissionPage(PERMISSIONS.PRODUCT_UPDATE, "/dashboard/products");

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
      variants: { orderBy: { position: "asc" }, select: { id: true, name: true, stock: true, price: true, isActive: true } },
      relatedFrom: { orderBy: { position: "asc" }, select: { relatedId: true } },
      inventoryMovements: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true, type: true, quantityChange: true, quantityAfter: true,
          reason: true, createdAt: true, actor: { select: { name: true } },
        },
      },
    },
  });

  if (!product) notFound();

  const [categories, brands, otherProducts, settings] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      where: { deletedAt: null, id: { not: id }, status: "PUBLISHED" },
      orderBy: { name: "asc" },
      take: 300,
      select: { id: true, name: true, sku: true, price: true },
    }),
    getSettings(),
  ]);

  const specifications = Array.isArray(product.specifications)
    ? (product.specifications as Array<{ label: string; value: string }>)
        .map((row) => `${row.label}: ${row.value}`)
        .join("\n")
    : "";

  const values: ProductFormValues = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku ?? "",
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    specifications,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    costPrice: product.costPrice,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    weightGrams: product.weightGrams,
    tags: product.tags.join(", "),
    status: product.status,
    isFeatured: product.isFeatured,
    isTopSelling: product.isTopSelling,
    manualRank: product.manualRank,
    shippingMode: product.shippingMode,
    shippingFlatFee: product.shippingFlatFee,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    canonicalUrl: product.canonicalUrl ?? "",
    ogImageUrl: product.ogImageUrl ?? "",
    noIndex: product.noIndex,
  };

  return (
    <>
      <PageHeader
        title={product.name}
        description={`Last updated ${formatDateTime(product.updatedAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill status={product.status} />
            <Link href={`/product/${product.slug}`} className="btn-ghost btn-sm" target="_blank" rel="noopener noreferrer">
              View on shop
            </Link>
            <Link href={`/dashboard/products/${product.id}/variants`} className="btn-secondary btn-sm">Variants</Link>
            <Link href="/dashboard/products" className="btn-ghost btn-sm">← All products</Link>
          </div>
        }
      />

      <ProductForm
        values={values}
        categories={categories}
        brands={brands}
        uploadRecommendation={settings.upload.recommendedProductImage}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ProductGalleryManager
          productId={product.id}
          images={product.images.map((image) => ({
            id: image.id, url: image.url, alt: image.alt, isPrimary: image.isPrimary,
          }))}
          recommendation={settings.upload.recommendedProductImage}
          maxSizeMb={settings.upload.maxFileSizeMb}
        />

        <div className="stack">
          <InventoryAdjustForm
            productId={product.id}
            variants={product.variants.map((variant) => ({ id: variant.id, name: variant.name, stock: variant.stock }))}
          />

          <section className="card">
            <div className="card-header"><h2 className="card-title">Inventory history</h2></div>
            <div className="table-wrap border-0">
              <table className="table table-compact min-w-0">
                <thead>
                  <tr><th>When</th><th>Type</th><th className="text-right">Change</th><th className="text-right">After</th></tr>
                </thead>
                <tbody>
                  {product.inventoryMovements.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-brand-500">No movements yet.</td></tr>
                  ) : (
                    product.inventoryMovements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="text-xs">
                          {formatDateTime(movement.createdAt)}
                          {movement.actor ? <span className="muted-xs block">{movement.actor.name}</span> : null}
                          {movement.reason ? <span className="muted-xs block">{movement.reason}</span> : null}
                        </td>
                        <td className="text-xs">{movement.type}</td>
                        <td className={`td-num ${movement.quantityChange < 0 ? "text-danger-600" : "text-success-700"}`}>
                          {movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange}
                        </td>
                        <td className="td-num">{movement.quantityAfter}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-4">
        <RelatedProductsForm
          productId={product.id}
          defaultSelected={product.relatedFrom.map((row) => row.relatedId)}
          options={otherProducts.map((row) => ({
            id: row.id,
            label: row.name,
            hint: row.sku ?? undefined,
            price: row.price,
          }))}
        />
      </div>

      {product.variants.length > 0 ? (
        <section className="card mt-4">
          <div className="card-header">
            <h2 className="card-title">Variants ({product.variants.length})</h2>
            <Link href={`/dashboard/products/${product.id}/variants`} className="btn-secondary btn-sm">Manage variants</Link>
          </div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead>
                <tr><th>Variant</th><th className="text-right">Price</th><th className="text-right">Stock</th><th>Status</th></tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{variant.name}</td>
                    <td className="td-num">{formatMoney(variant.price)}</td>
                    <td className="td-num">{variant.stock}</td>
                    <td><StatusPill status={variant.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
