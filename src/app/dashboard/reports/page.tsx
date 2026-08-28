import Link from "next/link";

import { BreakdownList, SalesChart } from "@/components/dashboard/charts";
import { PageHeader, StatCard } from "@/components/ui";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import {
  getCouponPerformance, getDailySales, getDashboardSummary, getLowStockProducts,
  getOrderStatusBreakdown, getPaymentMethodBreakdown, getPaymentStatusBreakdown,
  getReturnsReport, getTopCustomers, getTopProducts, parseRange,
} from "@/lib/services/reports";
import { formatMoney } from "@/lib/money";
import { formatDate, maskPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.REPORT_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const range = parseRange(single("from"), single("to"), 30);

  const [
    summary, sales, statusBreakdown, paymentMethods, paymentStatuses,
    topProducts, topCustomers, coupons, returns, lowStock,
  ] = await Promise.all([
    getDashboardSummary(range),
    getDailySales(range),
    getOrderStatusBreakdown(range),
    getPaymentMethodBreakdown(range),
    getPaymentStatusBreakdown(range),
    getTopProducts(range, 15),
    getTopCustomers(range, 10),
    getCouponPerformance(range, 15),
    getReturnsReport(range),
    getLowStockProducts(15),
  ]);

  const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${formatDate(range.from)} – ${formatDate(range.to)} · all figures aggregated server-side`}
      />

      <form className="filter-bar" method="get">
        <div className="field">
          <label className="label" htmlFor="from">From</label>
          <input id="from" name="from" type="date" className="input" defaultValue={toDateInput(range.from)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="to">To</label>
          <input id="to" name="to" type="date" className="input" defaultValue={toDateInput(range.to)} />
        </div>
        <button type="submit" className="btn-secondary">Apply range</button>
        <Link href="/dashboard/reports" className="btn-ghost">Last 30 days</Link>
      </form>

      <div className="grid-stats">
        <StatCard label="Revenue" value={formatMoney(summary.revenue)} hint={`${summary.orderCount} orders`} />
        <StatCard label="Average order" value={formatMoney(summary.averageOrderValue)} />
        <StatCard label="Delivered" value={summary.deliveredOrders} />
        <StatCard label="Refunded" value={formatMoney(returns.refundTotal)} hint={`${returns.refundCount} refund(s)`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-header"><h2 className="card-title">Sales report</h2></div>
          <div className="card-body"><SalesChart data={sales} /></div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Payment methods</h2></div>
            <div className="card-body">
              {paymentMethods.length === 0 ? <p className="muted">No data.</p> : (
                <BreakdownList data={paymentMethods} formatValue={(value) => formatMoney(value)} />
              )}
            </div>
          </section>
          <section className="card">
            <div className="card-header"><h2 className="card-title">Payment status</h2></div>
            <div className="card-body">
              {paymentStatuses.length === 0 ? <p className="muted">No data.</p> : <BreakdownList data={paymentStatuses} />}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Order status</h2></div>
          <div className="card-body">
            {statusBreakdown.length === 0 ? <p className="muted">No orders in this range.</p> : <BreakdownList data={statusBreakdown} />}
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Top customers</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Customer</th><th className="text-right">Orders</th><th className="text-right">Spend</th></tr></thead>
              <tbody>
                {topCustomers.length === 0 ? (
                  <tr><td colSpan={3} className="py-4 text-center text-brand-500">No data.</td></tr>
                ) : (
                  topCustomers.map((customer, index) => (
                    <tr key={`${customer.userId}-${index}`}>
                      <td>
                        {customer.userId ? (
                          <Link href={`/dashboard/customers/${customer.userId}`} className="hover:underline">{customer.name}</Link>
                        ) : customer.name}
                        <p className="muted-xs">{maskPhone(customer.phone)}</p>
                      </td>
                      <td className="td-num">{customer.orders}</td>
                      <td className="td-num">{formatMoney(customer.spend)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card mt-4">
        <div className="card-header"><h2 className="card-title">Product performance</h2></div>
        <div className="table-wrap border-0">
          <table className="table">
            <thead><tr><th>Product</th><th className="text-right">Units sold</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>
              {topProducts.length === 0 ? (
                <tr><td colSpan={3} className="py-5 text-center text-brand-500">No sales in this range.</td></tr>
              ) : (
                topProducts.map((product, index) => (
                  <tr key={`${product.productId}-${index}`}>
                    <td>
                      {product.slug ? (
                        <Link href={`/product/${product.slug}`} className="hover:underline" target="_blank">{product.name}</Link>
                      ) : product.name}
                    </td>
                    <td className="td-num">{product.quantity}</td>
                    <td className="td-num">{formatMoney(product.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Coupon performance</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Coupon</th><th className="text-right">Uses</th><th className="text-right">Discount given</th></tr></thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr><td colSpan={3} className="py-4 text-center text-brand-500">No redemptions in this range.</td></tr>
                ) : (
                  coupons.map((coupon) => (
                    <tr key={coupon.couponId}>
                      <td>
                        <Link href={`/dashboard/coupons/${coupon.couponId}`} className="mono hover:underline">{coupon.code}</Link>
                        <p className="muted-xs clamp-1">{coupon.title}</p>
                      </td>
                      <td className="td-num">{coupon.uses}</td>
                      <td className="td-num">{formatMoney(coupon.discountGiven)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Inventory & low stock</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Product</th><th className="text-right">Stock</th><th className="text-right">Alert at</th></tr></thead>
              <tbody>
                {lowStock.length === 0 ? (
                  <tr><td colSpan={3} className="py-4 text-center text-brand-500">Everything is well stocked.</td></tr>
                ) : (
                  lowStock.map((product) => (
                    <tr key={product.id}>
                      <td><Link href={`/dashboard/products/${product.id}`} className="hover:underline">{product.name}</Link></td>
                      <td className={`td-num ${product.stock === 0 ? "text-danger-600" : "text-warning-600"}`}>{product.stock}</td>
                      <td className="td-num">{product.lowStockThreshold}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {returns.returns.length > 0 ? (
        <section className="card mt-4">
          <div className="card-header"><h2 className="card-title">Returns</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Order</th><th>Customer</th><th>Reason</th><th>Status</th><th className="text-right">Qty</th></tr></thead>
              <tbody>
                {returns.returns.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/dashboard/orders/${row.order.id}`} className="mono hover:underline">{row.order.orderNumber}</Link>
                    </td>
                    <td className="text-sm">{row.order.customerName}</td>
                    <td className="max-w-52 truncate text-xs">{row.reason}</td>
                    <td><span className="badge-outline">{row.status}</span></td>
                    <td className="td-num">{row.quantity}</td>
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
