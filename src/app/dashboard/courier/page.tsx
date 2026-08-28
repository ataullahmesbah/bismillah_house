import Link from "next/link";

import { PageHeader, StatCard, StatusPill } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { credentialsFor, getCourierAdapter } from "@/lib/courier/adapters";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

import { CourierTabs } from "./nav";

export const dynamic = "force-dynamic";

/** Parcels that have not reached a resting state yet. */
const IN_FLIGHT = ["CREATED", "PICKUP_PENDING", "PICKED", "IN_TRANSIT", "AT_HUB", "AT_DESTINATION", "OUT_FOR_DELIVERY", "HOLD"] as const;

export default async function CourierOverviewPage() {
  await requireAnyPermissionPage([PERMISSIONS.COURIER_DISPATCH, PERMISSIONS.COURIER_MANAGE]);

  const [couriers, inFlight, delivered, failed, receivable, awaiting, recent, failedDispatches] = await Promise.all([
    prisma.courier.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, code: true, provider: true, apiBaseUrl: true, isActive: true,
        _count: { select: { shipments: true } },
      },
    }),
    prisma.shipment.count({ where: { status: { in: [...IN_FLIGHT] } } }),
    prisma.shipment.count({ where: { status: "DELIVERED" } }),
    prisma.shipment.count({ where: { status: { in: ["FAILED", "RETURNED"] } } }),
    prisma.shipment.aggregate({
      where: { settlementStatus: { in: ["PENDING", "PARTIAL"] }, status: "DELIVERED" },
      _sum: { collectedAmount: true, settledAmount: true },
    }),
    prisma.order.count({
      where: { deletedAt: null, status: { in: ["CONFIRMED", "PROCESSING", "PACKED"] }, shipments: { none: {} } },
    }),
    prisma.shipment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true, status: true, trackingNumber: true, courierName: true, currentLocation: true,
        updatedAt: true, orderId: true, order: { select: { orderNumber: true } },
      },
    }),
    prisma.courierDispatchLog.count({ where: { success: false } }),
  ]);

  const outstanding = Math.max(0, (receivable._sum?.collectedAmount ?? 0) - (receivable._sum?.settledAmount ?? 0));

  return (
    <>
      <PageHeader
        title="Courier operations"
        description="Every parcel in flight, what couriers owe us, and what failed to get through."
      />
      <CourierTabs active="/dashboard/courier" />

      <div className="stat-grid mb-4">
        <StatCard
          label="Ready to dispatch"
          value={awaiting}
          hint="Confirmed orders with no parcel"
          href="/dashboard/orders?status=CONFIRMED"
        />
        <StatCard label="In flight" value={inFlight} href="/dashboard/courier/shipments" />
        <StatCard label="Delivered" value={delivered} />
        <StatCard label="Failed / returned" value={failed} href="/dashboard/courier/shipments?status=FAILED" />
        <StatCard
          label="Courier owes us"
          value={formatMoney(outstanding)}
          hint="Collected but not settled"
          href="/dashboard/courier/settlements"
        />
        <StatCard
          label="Dispatch failures"
          value={failedDispatches}
          hint="Attempts that did not go through"
          href="/dashboard/courier/logs"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Couriers</h2>
            <Link href="/dashboard/settings/courier" className="btn-ghost btn-xs">Configure</Link>
          </div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Courier</th><th>Integration</th><th className="text-right">Parcels</th></tr></thead>
              <tbody>
                {couriers.map((courier) => {
                  const adapter = getCourierAdapter(courier.provider);
                  const configured = adapter.supportsApi && credentialsFor(courier.code, courier.apiBaseUrl) !== null;
                  return (
                    <tr key={courier.id}>
                      <td>
                        <span className="font-semibold">{courier.name}</span>
                        {!courier.isActive ? <span className="badge-outline ml-2">Off</span> : null}
                      </td>
                      <td>
                        {configured ? (
                          <span className="badge-green">Automatic</span>
                        ) : adapter.supportsApi ? (
                          <span className="badge-amber">Needs credentials</span>
                        ) : (
                          <span className="badge-outline">Manual</span>
                        )}
                      </td>
                      <td className="td-num">{courier._count.shipments}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-body border-t border-line">
            <p className="muted-xs">
              Credentials are read from environment variables per courier code — for example
              {" "}<code className="mono">COURIER_PATHAO_API_KEY</code> and{" "}
              <code className="mono">COURIER_PATHAO_WEBHOOK_SECRET</code>. They are never stored in the database.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Latest movement</h2>
            <Link href="/dashboard/courier/shipments" className="btn-ghost btn-xs">All parcels</Link>
          </div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Order</th><th>Status</th><th>Where</th><th>Updated</th></tr></thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={4} className="muted py-6 text-center">No parcels yet.</td></tr>
                ) : (
                  recent.map((shipment) => (
                    <tr key={shipment.id}>
                      <td>
                        <Link href={`/dashboard/orders/${shipment.orderId}`} className="font-semibold hover:underline">
                          {shipment.order.orderNumber}
                        </Link>
                        <span className="muted-xs block">{shipment.courierName ?? "—"}</span>
                      </td>
                      <td><StatusPill status={shipment.status} /></td>
                      <td className="text-xs">{shipment.currentLocation ?? "—"}</td>
                      <td className="text-xs whitespace-nowrap">{formatDateTime(shipment.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
