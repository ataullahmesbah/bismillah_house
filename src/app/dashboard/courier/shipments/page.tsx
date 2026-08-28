import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatusPill } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ShipmentStatus } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

import { CourierTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUSES: ShipmentStatus[] = [
  "PENDING", "CREATED", "PICKUP_PENDING", "PICKED", "IN_TRANSIT", "AT_HUB", "AT_DESTINATION",
  "OUT_FOR_DELIVERY", "DELIVERED", "HOLD", "FAILED", "RETURNED", "CANCELLED",
];

export default async function ShipmentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAnyPermissionPage([PERMISSIONS.COURIER_DISPATCH, PERMISSIONS.COURIER_MANAGE]);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const rawStatus = single("status") ?? "";
  const status = STATUSES.includes(rawStatus as ShipmentStatus) ? (rawStatus as ShipmentStatus) : "";
  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const where: Prisma.ShipmentWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { trackingNumber: { contains: q, mode: "insensitive" } },
            { consignmentId: { contains: q, mode: "insensitive" } },
            { order: { orderNumber: { contains: q, mode: "insensitive" } } },
            { order: { customerPhone: { contains: q } } },
          ],
        }
      : {}),
  };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, status: true, trackingNumber: true, trackingUrl: true, courierName: true,
        currentLocation: true, updatedAt: true, courierCharge: true, collectedAmount: true,
        settlementStatus: true, syncError: true, orderId: true,
        order: { select: { orderNumber: true, customerName: true, grandTotal: true } },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  return (
    <>
      <PageHeader title="Shipments" description="Every parcel, wherever it is." />
      <CourierTabs active="/dashboard/courier/shipments" />

      <form method="get" className="card mb-4">
        <div className="card-body flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="ship-q">Search</label>
            <input id="ship-q" name="q" defaultValue={q} className="input" placeholder="Tracking number, order or phone" />
          </div>
          <div className="min-w-40">
            <label className="label" htmlFor="ship-status">Status</label>
            <select id="ship-status" name="status" defaultValue={status} className="select">
              <option value="">All</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{value.replace(/_/g, " ").toLowerCase()}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">Filter</button>
        </div>
      </form>

      {shipments.length === 0 ? (
        <div className="card"><div className="card-body">
          <EmptyState
            title="No parcels match"
            description="Send a confirmed order to the courier from its order page to create one."
          />
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th><th>Courier</th><th>Tracking</th><th>Status</th>
                <th>Where</th><th className="text-right">Value</th><th>Settlement</th><th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>
                    <Link href={`/dashboard/orders/${shipment.orderId}`} className="font-semibold hover:underline">
                      {shipment.order.orderNumber}
                    </Link>
                    <span className="muted-xs block clamp-1">{shipment.order.customerName}</span>
                  </td>
                  <td className="text-xs">{shipment.courierName ?? "—"}</td>
                  <td className="text-xs">
                    {shipment.trackingUrl ? (
                      <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="link">
                        {shipment.trackingNumber}
                      </a>
                    ) : (
                      shipment.trackingNumber ?? "—"
                    )}
                  </td>
                  <td>
                    <StatusPill status={shipment.status} />
                    {shipment.syncError ? <span className="muted-xs block">sync failed</span> : null}
                  </td>
                  <td className="text-xs">{shipment.currentLocation ?? "—"}</td>
                  <td className="td-num">{formatMoney(shipment.order.grandTotal)}</td>
                  <td><StatusPill status={shipment.settlementStatus} /></td>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(shipment.updatedAt)}</td>
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
          `/dashboard/courier/shipments${buildQuery({ q, status, page: next > 1 ? next : undefined })}`
        }
      />
    </>
  );
}
