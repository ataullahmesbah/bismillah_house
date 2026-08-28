import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatCard, StatusPill } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDate, parsePositiveInt } from "@/lib/utils";

import { CourierTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * What each courier has collected and what they have paid over.
 *
 * The point of this screen is that nobody opens the courier's dashboard to
 * reconcile: the collected amount, their charge and what actually landed are
 * all against the order, and the settlement posts straight into the books.
 */
export default async function SettlementsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAnyPermissionPage([PERMISSIONS.COURIER_SETTLEMENT, PERMISSIONS.FINANCE_VIEW]);
  const params = await searchParams;
  const page = parsePositiveInt(Array.isArray(params.page) ? params.page[0] : params.page, 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const where: Prisma.ShipmentWhereInput = { status: { in: ["DELIVERED", "RETURNED"] } };

  const [shipments, total, pending, received, byCourier] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: [{ settlementStatus: "asc" }, { deliveredAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, courierName: true, trackingNumber: true, status: true, deliveredAt: true,
        courierCharge: true, collectedAmount: true, settledAmount: true, settlementStatus: true,
        settledAt: true, orderId: true,
        order: { select: { orderNumber: true, grandTotal: true } },
      },
    }),
    prisma.shipment.count({ where }),
    prisma.shipment.aggregate({
      where: { ...where, settlementStatus: { in: ["PENDING", "PARTIAL"] } },
      _sum: { collectedAmount: true, settledAmount: true },
    }),
    prisma.shipment.aggregate({
      where: { ...where, settlementStatus: "RECEIVED" },
      _sum: { settledAmount: true, courierCharge: true },
    }),
    prisma.shipment.groupBy({
      by: ["courierName"],
      where: { ...where, settlementStatus: { in: ["PENDING", "PARTIAL"] } },
      _sum: { collectedAmount: true, settledAmount: true },
      _count: { _all: true },
    }),
  ]);

  const outstanding = Math.max(0, (pending._sum?.collectedAmount ?? 0) - (pending._sum?.settledAmount ?? 0));

  return (
    <>
      <PageHeader
        title="Courier settlements"
        description="Money the courier collected from customers, and what has actually reached us."
      />
      <CourierTabs active="/dashboard/courier/settlements" />

      <div className="stat-grid mb-4">
        <StatCard label="Outstanding" value={formatMoney(outstanding)} hint="Collected, not yet paid to us" />
        <StatCard label="Settled" value={formatMoney(received._sum?.settledAmount ?? 0)} />
        <StatCard label="Courier charges paid" value={formatMoney(received._sum?.courierCharge ?? 0)} />
        <StatCard label="Parcels awaiting settlement" value={byCourier.reduce((sum, row) => sum + row._count._all, 0)} />
      </div>

      {byCourier.length > 0 ? (
        <section className="card mb-4">
          <div className="card-header"><h2 className="card-title">Outstanding by courier</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Courier</th><th className="text-right">Parcels</th><th className="text-right">Collected</th><th className="text-right">Owed to us</th></tr></thead>
              <tbody>
                {byCourier.map((row) => (
                  <tr key={row.courierName ?? "unknown"}>
                    <td>{row.courierName ?? "Unnamed"}</td>
                    <td className="td-num">{row._count._all}</td>
                    <td className="td-num">{formatMoney(row._sum.collectedAmount ?? 0)}</td>
                    <td className="td-num font-bold">
                      {formatMoney(Math.max(0, (row._sum.collectedAmount ?? 0) - (row._sum.settledAmount ?? 0)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {shipments.length === 0 ? (
        <div className="card"><div className="card-body">
          <EmptyState
            title="Nothing to settle yet"
            description="Delivered parcels appear here so you can record what the courier paid over."
          />
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th><th>Courier</th><th>Delivered</th>
                <th className="text-right">Order value</th><th className="text-right">Collected</th>
                <th className="text-right">Charge</th><th className="text-right">Received</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>
                    <Link href={`/dashboard/orders/${shipment.orderId}`} className="font-semibold hover:underline">
                      {shipment.order.orderNumber}
                    </Link>
                  </td>
                  <td className="text-xs">{shipment.courierName ?? "—"}</td>
                  <td className="text-xs">{shipment.deliveredAt ? formatDate(shipment.deliveredAt) : "—"}</td>
                  <td className="td-num">{formatMoney(shipment.order.grandTotal)}</td>
                  <td className="td-num">{formatMoney(shipment.collectedAmount)}</td>
                  <td className="td-num">{formatMoney(shipment.courierCharge)}</td>
                  <td className="td-num">{formatMoney(shipment.settledAmount)}</td>
                  <td><StatusPill status={shipment.settlementStatus} /></td>
                  <td className="text-right">
                    <Link href={`/dashboard/orders/${shipment.orderId}`} className="btn-secondary btn-xs">
                      Record
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / perPage))}
        buildHref={(next) => `/dashboard/courier/settlements${buildQuery({ page: next > 1 ? next : undefined })}`}
      />
    </>
  );
}
