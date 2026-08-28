import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { ORDER_QUEUES, ORDER_STATUS_LABELS, PAGE_SIZES, PAYMENT_STATUS_LABELS, PERMISSIONS, orderQueueByKey } from "@/lib/constants";
import { orderWhereFromFilters } from "@/lib/services/reports";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDateTime, maskEmail, maskPhone, parsePositiveInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermissionPage(PERMISSIONS.ORDER_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const queue = orderQueueByKey(single("queue"));

  const filters = {
    q: single("q")?.trim() || undefined,
    statuses: queue.statuses,
    status: single("status") || undefined,
    paymentStatus: single("paymentStatus") || undefined,
    paymentMethod: single("paymentMethod") || undefined,
    districtId: single("district") || undefined,
    from: single("from") ? new Date(single("from") as string) : undefined,
    to: single("to") ? new Date(`${single("to")}T23:59:59`) : undefined,
  };
  const page = parsePositiveInt(single("page"), 1, 5000);

  const where = orderWhereFromFilters(filters);

  /*
   * Counts for every tab, using the same filters as the list so the numbers
   * describe what a click will actually show — grouped in one query rather
   * than one per tab.
   */
  const countsByStatus = await prisma.order.groupBy({
    by: ["status"],
    where: orderWhereFromFilters({ ...filters, statuses: [] }),
    _count: { _all: true },
  });

  const queueCounts = new Map(
    ORDER_QUEUES.map((entry) => [
      entry.key,
      entry.statuses.length === 0
        ? countsByStatus.reduce((sum, row) => sum + row._count._all, 0)
        : countsByStatus
            .filter((row) => (entry.statuses as readonly string[]).includes(row.status))
            .reduce((sum, row) => sum + row._count._all, 0),
    ]),
  );

  const [orders, total, districts, revenue, canSeeContact] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * PAGE_SIZES.dashboard,
      take: PAGE_SIZES.dashboard,
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true, customerEmail: true,
        status: true, paymentStatus: true, paymentMethod: true, grandTotal: true, placedAt: true,
        districtName: true, isFlagged: true, _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.district.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.order.aggregate({ where, _sum: { grandTotal: true } }),
    userHasPermission(user, PERMISSIONS.ORDER_VIEW_CONTACT),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZES.dashboard));

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"} · ${formatMoney(revenue._sum.grandTotal ?? 0)} total value`}
      />

      <nav className="tabs mb-4" aria-label="Order queues">
        {ORDER_QUEUES.map((entry) => {
          const count = queueCounts.get(entry.key) ?? 0;
          return (
            <Link
              key={entry.key}
              // Keeps the current search and filters, drops the page number.
              href={`/dashboard/orders${buildQuery({
                q: filters.q,
                status: single("status"),
                paymentStatus: single("paymentStatus"),
                paymentMethod: single("paymentMethod"),
                district: single("district"),
                from: single("from"),
                to: single("to"),
                queue: entry.key,
              })}`}
              className={entry.key === queue.key ? "tab tab-active" : "tab"}
              aria-current={entry.key === queue.key ? "page" : undefined}
            >
              {entry.label}
              <span className={count > 0 ? "tab-count" : "tab-count tab-count-empty"}>{count}</span>
            </Link>
          );
        })}
      </nav>

      <form className="filter-bar" method="get">
        <input type="hidden" name="queue" value={queue.key} />
        <div className="field min-w-52 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={filters.q ?? ""} placeholder="Order number, name, phone, email or product" />
        </div>
        <div className="field">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={filters.status ?? ""}>
            <option value="">All</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="paymentStatus">Payment</label>
          <select id="paymentStatus" name="paymentStatus" className="select" defaultValue={filters.paymentStatus ?? ""}>
            <option value="">All</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="paymentMethod">Method</label>
          <select id="paymentMethod" name="paymentMethod" className="select" defaultValue={filters.paymentMethod ?? ""}>
            <option value="">All</option>
            <option value="COD">Cash on delivery</option>
            <option value="BKASH">bKash</option>
            <option value="SSLCOMMERZ">Online gateway</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="district">District</label>
          <select id="district" name="district" className="select" defaultValue={filters.districtId ?? ""}>
            <option value="">All</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>{district.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="from">From</label>
          <input id="from" name="from" type="date" className="input" defaultValue={single("from") ?? ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="to">To</label>
          <input id="to" name="to" type="date" className="input" defaultValue={single("to") ?? ""} />
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
        <Link href="/dashboard/orders" className="btn-ghost">Reset</Link>
      </form>

      {orders.length === 0 ? (
        <EmptyState title="No orders match these filters" description="Try widening the date range or clearing a filter." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>District</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={order.isFlagged ? "bg-danger-50/40" : undefined}>
                    <td>
                      <Link href={`/dashboard/orders/${order.id}`} className="mono font-semibold hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="muted-xs">{formatDateTime(order.placedAt)} · {order._count.items} item(s)</p>
                      {order.isFlagged ? <span className="badge-red mt-1">Flagged</span> : null}
                    </td>
                    <td>
                      <p className="clamp-1 font-medium">{order.customerName}</p>
                      <p className="muted-xs">
                        {canSeeContact ? order.customerPhone : maskPhone(order.customerPhone)}
                      </p>
                      {order.customerEmail ? (
                        <p className="muted-xs">
                          {canSeeContact ? order.customerEmail : maskEmail(order.customerEmail)}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-xs">{order.districtName ?? "—"}</td>
                    <td><StatusPill status={order.status} /></td>
                    <td>
                      <StatusPill status={order.paymentStatus} />
                      <span className="muted-xs mt-1 block">{order.paymentMethod}</span>
                    </td>
                    <td className="td-num">{formatMoney(order.grandTotal)}</td>
                    <td className="td-actions">
                      <Link href={`/dashboard/orders/${order.id}`} className="btn-secondary btn-xs">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) =>
              `/dashboard/orders${buildQuery({
                q: filters.q,
                status: filters.status,
                paymentStatus: filters.paymentStatus,
                paymentMethod: filters.paymentMethod,
                district: filters.districtId,
                from: single("from"),
                to: single("to"),
                page: next > 1 ? next : undefined,
              })}`
            }
          />
        </>
      )}
    </>
  );
}
