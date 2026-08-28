import Link from "next/link";

import { EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Orders needing manual review — either explicitly flagged by staff or sitting
 * in the FRAUD_REVIEW state (PRD §11).
 */
export default async function FraudReviewPage() {
  await requirePermissionPage(PERMISSIONS.ORDER_FRAUD_REVIEW, "/dashboard/orders");

  const orders = await prisma.order.findMany({
    where: { deletedAt: null, OR: [{ isFlagged: true }, { status: "FRAUD_REVIEW" }] },
    orderBy: { placedAt: "desc" },
    take: 100,
    select: {
      id: true, orderNumber: true, customerName: true, customerPhone: true, status: true,
      paymentStatus: true, grandTotal: true, placedAt: true, districtName: true,
      flagReason: true, isFlagged: true,
    },
  });

  // How each customer's history looks — the signal staff actually act on.
  const phones = [...new Set(orders.map((order) => order.customerPhone))];
  const history = phones.length
    ? await prisma.order.groupBy({
        by: ["customerPhone", "status"],
        where: { customerPhone: { in: phones }, deletedAt: null },
        _count: true,
      })
    : [];

  const summaryByPhone = new Map<string, { total: number; bad: number }>();
  for (const row of history) {
    const entry = summaryByPhone.get(row.customerPhone) ?? { total: 0, bad: 0 };
    entry.total += row._count;
    if (["CANCELLED", "REJECTED", "RETURNED", "REFUNDED"].includes(row.status)) entry.bad += row._count;
    summaryByPhone.set(row.customerPhone, entry);
  }

  return (
    <>
      <PageHeader
        title="Fraud review"
        description="Orders flagged for manual verification before dispatch."
      />

      {orders.length === 0 ? (
        <EmptyState title="Nothing to review" description="No orders are currently flagged." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>History</th><th>Reason</th><th>Status</th><th className="text-right">Total</th><th /></tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const summary = summaryByPhone.get(order.customerPhone) ?? { total: 0, bad: 0 };
                const ratio = summary.total > 0 ? Math.round((summary.bad / summary.total) * 100) : 0;
                return (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/dashboard/orders/${order.id}`} className="mono font-semibold hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="muted-xs">{formatDateTime(order.placedAt)}</p>
                    </td>
                    <td>
                      <p className="font-medium">{order.customerName}</p>
                      <p className="muted-xs">{order.districtName}</p>
                    </td>
                    <td>
                      <span className={ratio >= 50 ? "badge-red" : ratio > 0 ? "badge-amber" : "badge-green"}>
                        {summary.bad}/{summary.total} bad
                      </span>
                      <Link
                        href={`/dashboard/customer-search?q=${encodeURIComponent(order.customerPhone)}`}
                        className="btn-link mt-1 block text-xs"
                      >
                        Full history →
                      </Link>
                    </td>
                    <td className="max-w-52 text-xs">{order.flagReason ?? "In fraud review state"}</td>
                    <td><StatusPill status={order.status} /></td>
                    <td className="td-num">{formatMoney(order.grandTotal)}</td>
                    <td className="td-actions">
                      <Link href={`/dashboard/orders/${order.id}`} className="btn-secondary btn-xs">Review</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
