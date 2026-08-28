import Link from "next/link";

import { PageHeader, StatCard, StatusPill } from "@/components/ui";
import { BreakdownList, SalesChart } from "@/components/dashboard/charts";
import { requireStaffPage } from "@/lib/auth/guards";
import { getEffectivePermissions } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import {
  getDailySales, getDashboardSummary, getLowStockProducts, getOrderStatusBreakdown,
  getPaymentMethodBreakdown, getRecentOrders, getTopProducts, parseRange,
} from "@/lib/services/reports";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGE_PRESETS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export default async function DashboardOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaffPage();
  const params = await searchParams;
  const days = Number(params.days) || 30;
  const range = parseRange(undefined, undefined, days);

  const permissions = await getEffectivePermissions(user.id, user.role);
  const canSeeOrders = permissions.has(PERMISSIONS.ORDER_VIEW);
  const canSeeReports = permissions.has(PERMISSIONS.REPORT_VIEW);

  const [summary, sales, statusBreakdown, paymentBreakdown, recentOrders, topProducts, lowStock] = await Promise.all([
    getDashboardSummary(range),
    canSeeReports ? getDailySales(range) : Promise.resolve([]),
    canSeeReports ? getOrderStatusBreakdown(range) : Promise.resolve([]),
    canSeeReports ? getPaymentMethodBreakdown(range) : Promise.resolve([]),
    canSeeOrders ? getRecentOrders(8) : Promise.resolve([]),
    canSeeReports ? getTopProducts(range, 6) : Promise.resolve([]),
    permissions.has(PERMISSIONS.INVENTORY_MANAGE) ? getLowStockProducts(6) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`Business overview for the last ${days} days.`}
        action={
          <div className="flex gap-1.5">
            {RANGE_PRESETS.map((preset) => (
              <Link
                key={preset.days}
                href={`/dashboard?days=${preset.days}`}
                className={preset.days === days ? "chip chip-active" : "chip"}
              >
                {preset.label}
              </Link>
            ))}
          </div>
        }
      />

      {params.denied === "1" ? (
        <div className="alert-warning mb-4" role="alert">
          <div>You do not have permission to open that section.</div>
        </div>
      ) : null}

      <div className="grid-stats">
        <StatCard label="Revenue" value={formatMoney(summary.revenue)} hint={`${summary.orderCount} orders placed`} />
        <StatCard label="Average order" value={formatMoney(summary.averageOrderValue)} />
        <StatCard label="Pending orders" value={summary.pendingOrders} href="/dashboard/orders?status=PENDING" />
        <StatCard label="Delivered" value={summary.deliveredOrders} href="/dashboard/orders?status=DELIVERED" />
      </div>

      <div className="grid-stats mt-3">
        <StatCard label="Customers" value={summary.customerCount} hint={`${summary.newCustomers} new`} href="/dashboard/customers" />
        <StatCard label="Low stock" value={summary.lowStockCount} hint={`${summary.outOfStockCount} out of stock`} href="/dashboard/inventory" />
        <StatCard label="Pending reviews" value={summary.pendingReviews} href="/dashboard/reviews?status=PENDING" />
        <StatCard label="Open conversations" value={summary.openConversations} href="/dashboard/messages" />
      </div>

      {summary.fraudReview > 0 ? (
        <div className="alert-danger mt-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{summary.fraudReview} order(s) flagged for fraud review</p>
            <Link href="/dashboard/orders/fraud-review" className="btn-link text-xs">Review them now →</Link>
          </div>
        </div>
      ) : null}

      {canSeeReports ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="card lg:col-span-2">
            <div className="card-header">
              <h2 className="card-title">Sales</h2>
              <span className="muted-xs">{formatDate(range.from)} – {formatDate(range.to)}</span>
            </div>
            <div className="card-body"><SalesChart data={sales} /></div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Order status</h2></div>
            <div className="card-body">
              {statusBreakdown.length === 0 ? <p className="muted">No orders yet.</p> : <BreakdownList data={statusBreakdown} />}
            </div>
          </section>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {canSeeOrders ? (
          <section className="card lg:col-span-2">
            <div className="card-header">
              <h2 className="card-title">Recent orders</h2>
              <Link href="/dashboard/orders" className="btn-link text-xs">All orders →</Link>
            </div>
            <div className="table-wrap border-0">
              <table className="table table-compact">
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>District</th><th>Status</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-brand-500">No orders yet.</td></tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/dashboard/orders/${order.id}`} className="mono font-semibold hover:underline">
                            {order.orderNumber}
                          </Link>
                          <span className="muted-xs block">{formatDate(order.placedAt)}</span>
                        </td>
                        <td className="max-w-40 truncate">{order.customerName}</td>
                        <td className="text-xs">{order.districtName ?? "—"}</td>
                        <td><StatusPill status={order.status} /></td>
                        <td className="td-num">{formatMoney(order.grandTotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="stack">
          {canSeeReports ? (
            <section className="card">
              <div className="card-header"><h2 className="card-title">Payment methods</h2></div>
              <div className="card-body">
                {paymentBreakdown.length === 0 ? (
                  <p className="muted">No data yet.</p>
                ) : (
                  <BreakdownList data={paymentBreakdown} formatValue={(value) => formatMoney(value)} />
                )}
              </div>
            </section>
          ) : null}

          {lowStock.length > 0 ? (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Low stock</h2>
                <Link href="/dashboard/inventory" className="btn-link text-xs">Manage →</Link>
              </div>
              <div className="card-body">
                <ul className="space-y-2">
                  {lowStock.map((product) => (
                    <li key={product.id} className="row-between text-sm">
                      <Link href={`/dashboard/products/${product.id}`} className="clamp-1 hover:underline">{product.name}</Link>
                      <span className={product.stock === 0 ? "stock-out" : "stock-low"}>{product.stock} left</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {canSeeReports && topProducts.length > 0 ? (
        <section className="card mt-4">
          <div className="card-header">
            <h2 className="card-title">Top selling products</h2>
            <Link href="/dashboard/reports" className="btn-link text-xs">Full reports →</Link>
          </div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead>
                <tr><th>Product</th><th className="text-right">Units</th><th className="text-right">Revenue</th></tr>
              </thead>
              <tbody>
                {topProducts.map((product) => (
                  <tr key={`${product.productId}-${product.name}`}>
                    <td>
                      {product.slug ? (
                        <Link href={`/product/${product.slug}`} className="hover:underline">{product.name}</Link>
                      ) : product.name}
                    </td>
                    <td className="td-num">{product.quantity}</td>
                    <td className="td-num">{formatMoney(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
