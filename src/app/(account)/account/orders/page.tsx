import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDate, parsePositiveInt } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "My orders", path: "/account/orders", noIndex: true });
}

const PER_PAGE = 10;

export default async function AccountOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const page = parsePositiveInt(typeof params.page === "string" ? params.page : undefined, 1, 1000);

  const where: Prisma.OrderWhereInput = {
    userId: user.id,
    deletedAt: null,
    ...(statusFilter === "active"
      ? { status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"] } }
      : statusFilter && statusFilter in ORDER_STATUS_LABELS
        ? { status: statusFilter as keyof typeof ORDER_STATUS_LABELS }
        : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true,
        grandTotal: true, placedAt: true, districtName: true,
        items: { take: 3, select: { productName: true, quantity: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader title="My orders" description={`${total} order${total === 1 ? "" : "s"} in your history.`} />

      <div className="toolbar">
        <Link href="/account/orders" className={statusFilter === "" ? "chip chip-active" : "chip"}>All</Link>
        <Link href="/account/orders?status=active" className={statusFilter === "active" ? "chip chip-active" : "chip"}>In progress</Link>
        <Link href="/account/orders?status=DELIVERED" className={statusFilter === "DELIVERED" ? "chip chip-active" : "chip"}>Delivered</Link>
        <Link href="/account/orders?status=CANCELLED" className={statusFilter === "CANCELLED" ? "chip chip-active" : "chip"}>Cancelled</Link>
        <Link href="/account/orders?status=RETURNED" className={statusFilter === "RETURNED" ? "chip chip-active" : "chip"}>Returned</Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders here"
          description="Orders you place will appear in this list."
          action={<Link href="/shop" className="btn-primary">Browse products</Link>}
        />
      ) : (
        <div className="stack">
          {orders.map((order) => (
            <article key={order.id} className="card">
              <div className="card-header">
                <div>
                  <p className="mono text-sm font-bold">{order.orderNumber}</p>
                  <p className="muted-xs">{formatDate(order.placedAt)} · {order.districtName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={order.status} />
                  <StatusPill status={order.paymentStatus} />
                </div>
              </div>
              <div className="card-body row-between flex-wrap gap-3">
                <div className="min-w-0 text-sm text-brand-600">
                  {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
                  {order._count.items > order.items.length ? ` +${order._count.items - order.items.length} more` : ""}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-base font-bold">{formatMoney(order.grandTotal)}</span>
                  <Link href={`/account/orders/${order.id}`} className="btn-secondary btn-sm">View details</Link>
                </div>
              </div>
            </article>
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) => `/account/orders${buildQuery({ status: statusFilter || undefined, page: next > 1 ? next : undefined })}`}
          />
        </div>
      )}
    </>
  );
}
