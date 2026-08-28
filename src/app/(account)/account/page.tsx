import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, StatCard, StatusPill, EmptyState } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "My account", path: "/account", noIndex: true });
}

export default async function AccountOverviewPage() {
  const user = await requireUser();

  const [orderCount, activeCount, deliveredCount, spend, recentOrders, addressCount] = await Promise.all([
    prisma.order.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.order.count({
      where: {
        userId: user.id,
        deletedAt: null,
        status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"] },
      },
    }),
    prisma.order.count({ where: { userId: user.id, status: "DELIVERED" } }),
    prisma.order.aggregate({
      where: { userId: user.id, status: { in: ["DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY"] } },
      _sum: { grandTotal: true },
    }),
    prisma.order.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { placedAt: "desc" },
      take: 5,
      select: {
        id: true, orderNumber: true, status: true, paymentStatus: true,
        grandTotal: true, placedAt: true, _count: { select: { items: true } },
      },
    }),
    prisma.address.count({ where: { userId: user.id, deletedAt: null } }),
  ]);

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Here is a summary of your account." />

      <div className="grid-stats">
        <StatCard label="Total orders" value={orderCount} href="/account/orders" />
        <StatCard label="In progress" value={activeCount} href="/account/orders?status=active" />
        <StatCard label="Delivered" value={deliveredCount} href="/account/orders?status=DELIVERED" />
        <StatCard label="Total spent" value={formatMoney(spend._sum.grandTotal ?? 0)} hint="Delivered & shipped orders" />
      </div>

      <section className="card mt-6">
        <div className="card-header">
          <h2 className="card-title">Recent orders</h2>
          <Link href="/account/orders" className="btn-link text-xs">View all →</Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="card-body">
            <EmptyState
              title="You have not ordered yet"
              description="When you place an order it will show up here with live delivery tracking."
              action={<Link href="/shop" className="btn-primary">Start shopping</Link>}
            />
          </div>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono font-semibold">{order.orderNumber}</td>
                    <td>{formatDate(order.placedAt)}</td>
                    <td>{order._count.items}</td>
                    <td><StatusPill status={order.status} /></td>
                    <td className="td-num">{formatMoney(order.grandTotal)}</td>
                    <td className="td-actions">
                      <Link href={`/account/orders/${order.id}`} className="btn-link text-xs">Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/account/addresses" className="card-hover p-5">
          <p className="text-sm font-bold">Delivery addresses</p>
          <p className="mt-1 text-xs text-brand-500">
            {addressCount === 0 ? "Add an address for faster checkout." : `${addressCount} saved address${addressCount === 1 ? "" : "es"}.`}
          </p>
        </Link>
        <Link href="/account/messages" className="card-hover p-5">
          <p className="text-sm font-bold">Need help?</p>
          <p className="mt-1 text-xs text-brand-500">Message our support team about any order.</p>
        </Link>
      </div>
    </>
  );
}
