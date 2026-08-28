import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatCard } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

import { InventoryTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Returns seen from the stock side.
 *
 * The customer-facing return request lives with orders; what matters here is
 * which units came back onto the shelf and which were written off instead.
 */
export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAnyPermissionPage([PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const [returned, movements, total, requests, refunded] = await Promise.all([
    prisma.inventoryMovement.aggregate({ where: { type: "RETURN" }, _sum: { quantityChange: true } }),
    prisma.inventoryMovement.findMany({
      where: { type: "RETURN" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, quantityChange: true, quantityAfter: true, reason: true, createdAt: true,
        referenceId: true, actorName: true,
        product: { select: { id: true, name: true } },
        variant: { select: { name: true } },
      },
    }),
    prisma.inventoryMovement.count({ where: { type: "RETURN" } }),
    prisma.returnRequest.count({ where: { status: { in: ["REQUESTED", "APPROVED", "RECEIVED"] } } }),
    prisma.refund.aggregate({ where: { status: "PROCESSED" }, _sum: { amount: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Returns"
        description="Units that came back into stock, and the return requests still waiting on a decision."
      />
      <InventoryTabs active="/dashboard/inventory/returns" />

      <div className="stat-grid mb-4">
        <StatCard label="Units returned to stock" value={returned._sum?.quantityChange ?? 0} />
        <StatCard label="Return entries" value={total} />
        <StatCard label="Open return requests" value={requests} href="/dashboard/orders?status=RETURNED" />
        <StatCard label="Refunded" value={formatMoney(refunded._sum?.amount ?? 0)} />
      </div>

      {movements.length === 0 ? (
        <div className="card"><div className="card-body">
          <EmptyState
            title="Nothing has been returned"
            description="When an order is marked returned, the units come back here."
          />
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th><th>Product</th><th className="text-right">Units</th>
                <th className="text-right">Stock after</th><th>Reason</th><th>Order</th><th>By</th>
              </tr>
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
                  <td className="td-num text-success-600">+{movement.quantityChange}</td>
                  <td className="td-num">{movement.quantityAfter}</td>
                  <td className="text-xs clamp-2">{movement.reason ?? "—"}</td>
                  <td className="text-xs">
                    {movement.referenceId ? (
                      <Link href={`/dashboard/orders/${movement.referenceId}`} className="hover:underline">View</Link>
                    ) : "—"}
                  </td>
                  <td className="text-xs">{movement.actorName ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / perPage))}
        buildHref={(next) => `/dashboard/inventory/returns${buildQuery({ page: next > 1 ? next : undefined })}`}
      />
    </>
  );
}
