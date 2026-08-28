import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, StatCard, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, maskEmail, maskPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function CustomerDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const staff = await requirePermissionPage(PERMISSIONS.CUSTOMER_VIEW, "/dashboard/customers");

  const customer = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER", deletedAt: null },
    select: {
      id: true, name: true, email: true, phone: true, status: true, createdAt: true,
      lastLoginAt: true, staffNote: true,
      addresses: {
        where: { deletedAt: null },
        select: { id: true, label: true, fullName: true, phone: true, addressLine1: true, area: true, districtName: true, isDefault: true },
      },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 25,
        select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, placedAt: true },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, rating: true, status: true, createdAt: true, product: { select: { name: true, slug: true } } },
      },
    },
  });

  if (!customer) notFound();

  const [stats, canContact] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { userId: customer.id, deletedAt: null },
      _count: true,
      _sum: { grandTotal: true },
    }),
    userHasPermission(staff, PERMISSIONS.ORDER_VIEW_CONTACT),
  ]);

  const totalOrders = stats.reduce((sum, row) => sum + row._count, 0);
  const delivered = stats.find((row) => row.status === "DELIVERED");
  const badOutcomes = stats
    .filter((row) => ["CANCELLED", "REJECTED", "RETURNED", "REFUNDED"].includes(row.status))
    .reduce((sum, row) => sum + row._count, 0);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`Customer since ${formatDate(customer.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill status={customer.status} />
            {customer.phone ? (
              <Link href={`/dashboard/customer-search?q=${encodeURIComponent(customer.phone)}`} className="btn-secondary btn-sm">
                Full order history
              </Link>
            ) : null}
            <Link href="/dashboard/customers" className="btn-ghost btn-sm">← All customers</Link>
          </div>
        }
      />

      <div className="grid-stats">
        <StatCard label="Orders" value={totalOrders} />
        <StatCard label="Delivered" value={delivered?._count ?? 0} />
        <StatCard label="Cancelled / returned" value={badOutcomes} />
        <StatCard label="Delivered value" value={formatMoney(delivered?._sum.grandTotal ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Recent orders</h2></div>
            <div className="table-wrap border-0">
              <table className="table table-compact">
                <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {customer.orders.length === 0 ? (
                    <tr><td colSpan={4} className="py-5 text-center text-brand-500">No orders yet.</td></tr>
                  ) : (
                    customer.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/dashboard/orders/${order.id}`} className="mono font-semibold hover:underline">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="text-xs">{formatDateTime(order.placedAt)}</td>
                        <td><StatusPill status={order.status} /></td>
                        <td className="td-num">{formatMoney(order.grandTotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {customer.reviews.length > 0 ? (
            <section className="card">
              <div className="card-header"><h2 className="card-title">Reviews</h2></div>
              <div className="table-wrap border-0">
                <table className="table table-compact">
                  <thead><tr><th>Product</th><th>Rating</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {customer.reviews.map((review) => (
                      <tr key={review.id}>
                        <td><Link href={`/product/${review.product.slug}`} className="hover:underline">{review.product.name}</Link></td>
                        <td>{review.rating}/5</td>
                        <td><StatusPill status={review.status} /></td>
                        <td className="text-xs">{formatDate(review.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Contact</h2></div>
            <div className="card-body space-y-1.5 text-sm text-brand-600">
              <p>{canContact ? customer.email : maskEmail(customer.email)}</p>
              <p>{customer.phone ? (canContact ? customer.phone : maskPhone(customer.phone)) : "No phone on file"}</p>
              <p className="muted-xs">
                {customer.lastLoginAt ? `Last signed in ${formatDateTime(customer.lastLoginAt)}` : "Has never signed in"}
              </p>
              {customer.staffNote ? (
                <p className="mt-2 rounded-[var(--radius-tm)] bg-surface-muted p-2 text-xs">{customer.staffNote}</p>
              ) : null}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Addresses</h2></div>
            <div className="card-body stack">
              {customer.addresses.length === 0 ? (
                <p className="muted">No saved addresses.</p>
              ) : (
                customer.addresses.map((address) => (
                  <div key={address.id} className="panel text-sm">
                    <p className="font-semibold">
                      {address.label ?? address.fullName}
                      {address.isDefault ? <span className="badge-gray ml-2">Default</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-brand-600">
                      {address.addressLine1}
                      {address.area ? `, ${address.area}` : ""}
                      <br />
                      {address.districtName} · {canContact ? address.phone : maskPhone(address.phone)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
