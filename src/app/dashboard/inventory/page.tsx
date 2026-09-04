import Link from "next/link";

import { PageHeader, StatCard } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { getInventoryTotals, listProductStock } from "@/lib/services/inventory";
import { prisma } from "@/lib/db";
import { MOVEMENT_TYPE_LABELS } from "@/lib/services/inventory.shared";

import { InventoryTabs } from "./nav";

export const dynamic = "force-dynamic";

export default async function InventoryOverviewPage() {
  await requireAnyPermissionPage([PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]);

  const [totals, low, movements, incoming] = await Promise.all([
    getInventoryTotals(),
    listProductStock({ filter: "low", take: 8 }),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, type: true, quantityChange: true, quantityAfter: true, createdAt: true,
        actorName: true, product: { select: { id: true, name: true } }, variant: { select: { name: true } },
      },
    }),
    prisma.stockIncoming.count({ where: { status: { in: ["EXPECTED", "PARTIAL"] } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="What is on the shelf, what is promised to customers, and what is on its way."
      />
      <InventoryTabs active="/dashboard/inventory" />

      <div className="grid-stats">
        <StatCard label="Products" value={totals.totalProducts} hint={`${totals.totalVariants} variants`} />
        <StatCard label="On hand" value={totals.onHandUnits} hint="Available + reserved" />
        <StatCard
          label="Available"
          value={totals.availableUnits}
          hint="Sellable right now"
          href="/dashboard/inventory/products"
        />
        <StatCard label="Reserved" value={totals.reservedUnits} hint="Promised to open orders" />
        <StatCard
          label="Incoming"
          value={totals.incomingUnits}
          hint={`${incoming} shipment(s) expected`}
          href="/dashboard/inventory/incoming"
        />
        <StatCard label="Damaged" value={totals.damagedUnits} hint="Written off, still on site" />
        <StatCard
          label="Low stock"
          value={totals.lowStockCount}
          hint="At or below alert level"
          href="/dashboard/inventory/low-stock"
        />
        <StatCard
          label="Out of stock"
          value={totals.outOfStockCount}
          hint="Nothing left to sell"
          href="/dashboard/inventory/out-of-stock"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Stock value</h2>
          </div>
          <div className="card-body space-y-3">
            <div className="row-between">
              <span className="muted">At cost</span>
              <span className="font-bold">{formatMoney(totals.stockValueCost)}</span>
            </div>
            <div className="row-between">
              <span className="muted">At retail</span>
              <span className="font-bold">{formatMoney(totals.stockValueRetail)}</span>
            </div>
            <div className="row-between border-t border-line pt-3">
              <span className="muted">Potential margin</span>
              <span className="font-bold text-success-700">
                {formatMoney(Math.max(0, totals.stockValueRetail - totals.stockValueCost))}
              </span>
            </div>
            <p className="muted-xs">
              Valued on available units only. Reserved stock is already accounted for in open orders.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Needs restocking</h2>
            <Link href="/dashboard/inventory/low-stock" className="btn-ghost btn-xs">See all</Link>
          </div>
          <div className="card-body">
            {low.rows.length === 0 ? (
              <p className="muted">Nothing is running low. </p>
            ) : (
              <ul className="space-y-2">
                {low.rows.map((row) => (
                  <li key={row.id} className="row-between text-sm">
                    <Link href={`/dashboard/products/${row.productId}`} className="clamp-1 hover:underline">
                      {row.name}
                    </Link>
                    <span className={row.available === 0 ? "stock-out" : "stock-low"}>
                      {row.available} left · alert at {row.lowStockThreshold}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="card mt-4">
        <div className="card-header">
          <h2 className="card-title">Latest movements</h2>
          <Link href="/dashboard/inventory/movements" className="btn-ghost btn-xs">Full history</Link>
        </div>
        <div className="table-wrap border-0">
          <table className="table table-compact">
            <thead>
              <tr><th>When</th><th>Product</th><th>Type</th><th className="text-right">Change</th><th className="text-right">After</th><th>By</th></tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(movement.createdAt)}</td>
                  <td>
                    <Link href={`/dashboard/products/${movement.product.id}`} className="clamp-1 hover:underline">
                      {movement.product.name}
                    </Link>
                    {movement.variant ? <span className="muted-xs block">{movement.variant.name}</span> : null}
                  </td>
                  <td><span className="badge-outline">{MOVEMENT_TYPE_LABELS[movement.type]}</span></td>
                  <td className={`td-num ${movement.quantityChange < 0 ? "text-danger-600" : "text-success-700"}`}>
                    {movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange}
                  </td>
                  <td className="td-num">{movement.quantityAfter}</td>
                  <td className="text-xs">{movement.actorName ?? "System"}</td>
                </tr>
              ))}
              {movements.length === 0 ? (
                <tr><td colSpan={6} className="muted py-6 text-center">No stock has moved yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
