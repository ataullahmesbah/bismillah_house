import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatCard, StatusPill } from "@/components/ui";
import { QuickActionForm } from "@/components/dashboard/action-form";
import { cancelIncomingStockAction } from "@/app/actions/dashboard/inventory";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDate, parsePositiveInt } from "@/lib/utils";

import { InventoryTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IncomingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAnyPermissionPage([PERMISSIONS.INVENTORY_RECEIVE, PERMISSIONS.INVENTORY_MANAGE]);
  const params = await searchParams;
  const page = parsePositiveInt(Array.isArray(params.page) ? params.page[0] : params.page, 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const [shipments, total, expectedUnits] = await Promise.all([
    prisma.stockIncoming.findMany({
      orderBy: [{ status: "asc" }, { expectedAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, reference: true, supplierName: true, status: true, expectedAt: true, receivedAt: true,
        shippingCost: true, createdAt: true,
        warehouse: { select: { name: true } },
        items: { select: { quantity: true, receivedQuantity: true, unitCost: true } },
      },
    }),
    prisma.stockIncoming.count(),
    prisma.product.aggregate({ _sum: { stockIncoming: true } }),
  ]);

  const open = shipments.filter((row) => row.status === "EXPECTED" || row.status === "PARTIAL").length;

  return (
    <>
      <PageHeader
        title="Incoming stock"
        description="Shipments on their way from suppliers. Nothing here is sellable until it is received."
        action={
          <Link href="/dashboard/inventory/incoming/new" className="btn-primary">Record shipment</Link>
        }
      />
      <InventoryTabs active="/dashboard/inventory/incoming" />

      <div className="stat-grid mb-4">
        <StatCard label="Units expected" value={expectedUnits._sum?.stockIncoming ?? 0} />
        <StatCard label="Open shipments" value={open} />
        <StatCard label="All shipments" value={total} />
      </div>

      {shipments.length === 0 ? (
        <div className="card"><div className="card-body">
          <EmptyState
            title="No incoming shipments"
            description="Record what a supplier is sending so the dashboard can show what is on its way."
            action={<Link href="/dashboard/inventory/incoming/new" className="btn-primary">Record shipment</Link>}
          />
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th><th>Supplier</th><th>Status</th>
                <th className="text-right">Units</th><th className="text-right">Value</th>
                <th>Expected</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => {
                const ordered = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
                const received = shipment.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
                const value =
                  shipment.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) + shipment.shippingCost;
                const closed = shipment.status === "RECEIVED" || shipment.status === "CANCELLED";
                return (
                  <tr key={shipment.id}>
                    <td>
                      <Link href={`/dashboard/inventory/incoming/${shipment.id}`} className="font-semibold hover:underline">
                        {shipment.reference}
                      </Link>
                      {shipment.warehouse ? <span className="muted-xs block">{shipment.warehouse.name}</span> : null}
                    </td>
                    <td className="text-sm">{shipment.supplierName}</td>
                    <td><StatusPill status={shipment.status} /></td>
                    <td className="td-num">{received} / {ordered}</td>
                    <td className="td-num">{formatMoney(value)}</td>
                    <td className="text-xs">{shipment.expectedAt ? formatDate(shipment.expectedAt) : "—"}</td>
                    <td className="text-right">
                      <div className="row-actions">
                        <Link href={`/dashboard/inventory/incoming/${shipment.id}`} className="btn-secondary btn-xs">
                          {closed ? "View" : "Receive"}
                        </Link>
                        {!closed ? (
                          <QuickActionForm
                            action={cancelIncomingStockAction}
                            values={{ incomingId: shipment.id }}
                            label="Cancel"
                            className="btn-danger-soft btn-xs"
                            confirm={`Cancel ${shipment.reference}? Units not yet received stop being counted as incoming.`}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / perPage))}
        buildHref={(next) => `/dashboard/inventory/incoming${buildQuery({ page: next > 1 ? next : undefined })}`}
      />
    </>
  );
}
