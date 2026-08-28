import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { StockAdjuster, type AdjustTarget } from "@/components/dashboard/stock-adjuster";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { MOVEMENT_TYPE_LABELS } from "@/lib/services/inventory.shared";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

import { InventoryTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Types produced by a person rather than by the order pipeline. */
const MANUAL_TYPES = [
  "ADJUSTMENT", "DAMAGED", "LOST", "EXPIRED", "COUNT_CORRECTION",
  "TRANSFER_IN", "TRANSFER_OUT", "RECEIVED",
] as const;

export default async function AdjustmentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.INVENTORY_ADJUST);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;
  const preselect = single("variant") || single("product") || undefined;

  const [products, variants, warehouses, history, total] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, hasVariants: false },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, sku: true, stock: true },
    }),
    prisma.productVariant.findMany({
      where: { product: { deletedAt: null } },
      orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
      take: 500,
      select: { id: true, name: true, sku: true, stock: true, productId: true, product: { select: { name: true } } },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { position: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.inventoryMovement.findMany({
      where: { type: { in: [...MANUAL_TYPES] } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, type: true, quantityChange: true, quantityAfter: true, reason: true, createdAt: true,
        actorName: true, product: { select: { name: true } }, variant: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
    }),
    prisma.inventoryMovement.count({ where: { type: { in: [...MANUAL_TYPES] } } }),
  ]);

  const targets: AdjustTarget[] = [
    ...products.map((product) => ({
      id: product.id,
      productId: product.id,
      variantId: null,
      label: product.sku ? `${product.name} (${product.sku})` : product.name,
      available: product.stock,
    })),
    ...variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      variantId: variant.id,
      label: `${variant.product.name} — ${variant.name}${variant.sku ? ` (${variant.sku})` : ""}`,
      available: variant.stock,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Stock adjustments"
        description="Move stock by hand and leave a reason behind. Every line here is permanent."
      />
      <InventoryTabs active="/dashboard/inventory/adjustments" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section className="card self-start">
          <div className="card-header"><h2 className="card-title">New adjustment</h2></div>
          <StockAdjuster targets={targets} warehouses={warehouses} defaultTargetId={preselect} />
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Adjustment history</h2></div>
          {history.length === 0 ? (
            <div className="card-body">
              <EmptyState
                title="No manual adjustments yet"
                description="Damage, losses, counts and transfers will be listed here."
              />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>When</th><th>Product</th><th>Reason</th>
                    <th className="text-right">Change</th><th className="text-right">After</th><th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td className="text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                      <td>
                        <span className="clamp-1">{row.product.name}</span>
                        {row.variant ? <span className="muted-xs block">{row.variant.name}</span> : null}
                        {row.warehouse ? <span className="muted-xs block">{row.warehouse.name}</span> : null}
                      </td>
                      <td>
                        <span className="badge-outline">{MOVEMENT_TYPE_LABELS[row.type]}</span>
                        {row.reason ? <span className="muted-xs block clamp-2">{row.reason}</span> : null}
                      </td>
                      <td className={`td-num ${row.quantityChange < 0 ? "text-danger-600" : "text-success-600"}`}>
                        {row.quantityChange > 0 ? "+" : ""}{row.quantityChange}
                      </td>
                      <td className="td-num">{row.quantityAfter}</td>
                      <td className="text-xs">{row.actorName ?? "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / perPage))}
            buildHref={(next) =>
              `/dashboard/inventory/adjustments${buildQuery({ page: next > 1 ? next : undefined })}`
            }
          />
        </section>
      </div>
    </>
  );
}
