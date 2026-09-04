import Link from "next/link";

import { PageHeader, StatCard } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getInventoryTotals, listProductStock } from "@/lib/services/inventory";
import { MOVEMENT_TYPE_LABELS } from "@/lib/services/inventory.shared";
import { rangeFromDays } from "@/lib/services/reports";

import { InventoryTabs } from "../nav";

export const dynamic = "force-dynamic";

const DOWNLOADS = [
  { scope: "products", label: "All product stock", hint: "On hand, reserved, available and stock value per product." },
  { scope: "variants", label: "All variant stock", hint: "The same figures broken down by size, colour or pack." },
  { scope: "low", label: "Low stock", hint: "Everything at or below its alert level — the reorder list." },
  { scope: "out", label: "Out of stock", hint: "Products currently turning shoppers away." },
  { scope: "movements", label: "Stock movements", hint: "The full ledger, for reconciling against a physical count." },
] as const;

export default async function InventoryReportsPage() {
  await requireAnyPermissionPage([PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]);

  const { from: thirtyDaysAgo } = rangeFromDays(30);

  const [totals, byType, topMoved, dead] = await Promise.all([
    getInventoryTotals(),
    prisma.inventoryMovement.groupBy({
      by: ["type"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { quantityChange: true },
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: { deletedAt: null, soldCount: { gt: 0 } },
      orderBy: { soldCount: "desc" },
      take: 10,
      select: { id: true, name: true, soldCount: true, stock: true, stockReserved: true },
    }),
    // Nothing sold, but money is sitting on the shelf.
    listProductStock({ take: 10 }).then(({ rows }) => rows.filter((row) => row.available > 0)),
  ]);

  return (
    <>
      <PageHeader
        title="Inventory reports"
        description="Where the stock money is, what has moved lately, and downloads for your accountant."
      />
      <InventoryTabs active="/dashboard/inventory/reports" />

      <div className="grid-stats mb-4">
        <StatCard label="Stock value at cost" value={formatMoney(totals.stockValueCost)} />
        <StatCard label="Stock value at retail" value={formatMoney(totals.stockValueRetail)} />
        <StatCard
          label="Potential margin"
          value={formatMoney(Math.max(0, totals.stockValueRetail - totals.stockValueCost))}
        />
        <StatCard label="Units on hand" value={totals.onHandUnits} hint={`${totals.reservedUnits} reserved`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Movement in the last 30 days</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead>
                <tr><th>Type</th><th className="text-right">Entries</th><th className="text-right">Net units</th></tr>
              </thead>
              <tbody>
                {byType.length === 0 ? (
                  <tr><td colSpan={3} className="muted py-6 text-center">Nothing has moved this month.</td></tr>
                ) : (
                  byType.map((row) => (
                    <tr key={row.type}>
                      <td>{MOVEMENT_TYPE_LABELS[row.type]}</td>
                      <td className="td-num">{row._count._all}</td>
                      <td className={`td-num ${(row._sum.quantityChange ?? 0) < 0 ? "text-danger-600" : "text-success-700"}`}>
                        {(row._sum.quantityChange ?? 0) > 0 ? "+" : ""}{row._sum.quantityChange ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Best sellers and their cover</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead>
                <tr><th>Product</th><th className="text-right">Sold</th><th className="text-right">Available</th><th className="text-right">Reserved</th></tr>
              </thead>
              <tbody>
                {topMoved.length === 0 ? (
                  <tr><td colSpan={4} className="muted py-6 text-center">No sales recorded yet.</td></tr>
                ) : (
                  topMoved.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <Link href={`/dashboard/products/${product.id}`} className="clamp-1 hover:underline">{product.name}</Link>
                      </td>
                      <td className="td-num">{product.soldCount}</td>
                      <td className="td-num">
                        <span className={product.stock === 0 ? "stock-out" : "stock-in"}>{product.stock}</span>
                      </td>
                      <td className="td-num">{product.stockReserved}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card mt-4">
        <div className="card-header"><h2 className="card-title">Downloads</h2></div>
        <div className="card-body">
          <p className="muted-xs mb-3">
            CSV opens directly in Excel, Google Sheets and LibreOffice, and imports into accounting software.
            Bangla product names are exported as UTF-8 with a byte-order mark so Excel renders them correctly.
          </p>
          <ul className="divide-y divide-line">
            {DOWNLOADS.map((download) => (
              <li key={download.scope} className="row-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{download.label}</span>
                  <span className="muted-xs block">{download.hint}</span>
                </span>
                <Link
                  href={`/api/dashboard/inventory/export?scope=${download.scope}`}
                  className="btn-secondary btn-sm shrink-0"
                  prefetch={false}
                >
                  Download CSV
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {dead.length > 0 ? (
        <section className="card mt-4">
          <div className="card-header"><h2 className="card-title">Lowest stock cover</h2></div>
          <div className="card-body">
            <ul className="space-y-2">
              {dead.map((row) => (
                <li key={row.id} className="row-between text-sm">
                  <Link href={`/dashboard/products/${row.productId}`} className="clamp-1 hover:underline">{row.name}</Link>
                  <span className="muted-xs">
                    {row.available} available · {formatMoney(row.available * (row.costPrice ?? 0))} tied up
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
