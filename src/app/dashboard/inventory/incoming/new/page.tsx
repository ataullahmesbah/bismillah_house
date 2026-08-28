import { PageHeader } from "@/components/ui";
import { IncomingBuilder, type IncomingOption } from "@/components/dashboard/incoming-builder";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";

import { InventoryTabs } from "../../nav";

export const dynamic = "force-dynamic";

export default async function NewIncomingPage() {
  await requirePermissionPage(PERMISSIONS.INVENTORY_RECEIVE);

  const [products, variants, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, hasVariants: false },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, sku: true, costPrice: true },
    }),
    prisma.productVariant.findMany({
      where: { product: { deletedAt: null } },
      orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
      take: 500,
      select: { id: true, name: true, sku: true, costPrice: true, productId: true, product: { select: { name: true } } },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { position: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const options: IncomingOption[] = [
    ...products.map((product) => ({
      id: product.id,
      productId: product.id,
      variantId: null,
      label: product.sku ? `${product.name} (${product.sku})` : product.name,
      costPrice: product.costPrice,
    })),
    ...variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      variantId: variant.id,
      label: `${variant.product.name} — ${variant.name}${variant.sku ? ` (${variant.sku})` : ""}`,
      costPrice: variant.costPrice,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Record incoming shipment"
        description="Tell the shop what is on its way. It counts as incoming, never as sellable, until you receive it."
      />
      <InventoryTabs active="/dashboard/inventory/incoming" />
      <IncomingBuilder options={options} warehouses={warehouses} />
    </>
  );
}
