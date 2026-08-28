import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { humanizeEnum } from "@/lib/utils";

/**
 * Server-side aggregation for the dashboard and reports (PRD §19/§30).
 * Charts always consume these summaries — raw tables are never sent to a client.
 */

const REVENUE_STATUSES: OrderStatus[] = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

export type DateRange = { from: Date; to: Date };

export function rangeFromDays(days: number): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function parseRange(fromInput?: string, toInput?: string, fallbackDays = 30): DateRange {
  const fallback = rangeFromDays(fallbackDays);
  const from = fromInput ? new Date(fromInput) : fallback.from;
  const to = toInput ? new Date(`${toInput}T23:59:59`) : fallback.to;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return fallback;
  return { from, to };
}

export type DashboardSummary = {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  pendingOrders: number;
  fraudReview: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  customerCount: number;
  newCustomers: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingReviews: number;
  openConversations: number;
  activeCoupons: number;
  unreadLeads: number;
};

export async function getDashboardSummary(range: DateRange): Promise<DashboardSummary> {
  const window = { gte: range.from, lte: range.to };

  const [
    revenueAggregate, orderCount, pendingOrders, fraudReview, deliveredOrders,
    cancelledOrders, returnedOrders, customerCount, newCustomers,
    lowStockCount, outOfStockCount, pendingReviews, openConversations, activeCoupons, unreadLeads,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { placedAt: window, status: { in: REVENUE_STATUSES }, deletedAt: null },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.order.count({ where: { placedAt: window, deletedAt: null } }),
    prisma.order.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.order.count({ where: { status: "FRAUD_REVIEW", deletedAt: null } }),
    prisma.order.count({ where: { placedAt: window, status: "DELIVERED", deletedAt: null } }),
    prisma.order.count({ where: { placedAt: window, status: { in: ["CANCELLED", "REJECTED"] }, deletedAt: null } }),
    prisma.order.count({ where: { placedAt: window, status: { in: ["RETURNED", "REFUNDED"] }, deletedAt: null } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null, createdAt: window } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM products
      WHERE "deletedAt" IS NULL AND status = 'PUBLISHED'
        AND stock > 0 AND stock <= "lowStockThreshold"`,
    prisma.product.count({ where: { deletedAt: null, status: "PUBLISHED", stock: 0, hasVariants: false } }),
    prisma.review.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.conversation.count({ where: { status: { in: ["OPEN", "PENDING"] }, deletedAt: null } }),
    prisma.coupon.count({
      where: { isActive: true, deletedAt: null, startAt: { lte: new Date() }, endAt: { gt: new Date() } },
    }),
    prisma.contactLead.count({ where: { status: "NEW" } }),
  ]);

  const revenue = revenueAggregate._sum.grandTotal ?? 0;
  const paidOrders = revenueAggregate._count;

  return {
    revenue,
    orderCount,
    averageOrderValue: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
    pendingOrders,
    fraudReview,
    deliveredOrders,
    cancelledOrders,
    returnedOrders,
    customerCount,
    newCustomers,
    lowStockCount: Number(lowStockCount[0]?.count ?? 0),
    outOfStockCount,
    pendingReviews,
    openConversations,
    activeCoupons,
    unreadLeads,
  };
}

export type SeriesPoint = { label: string; value: number };

/** Daily revenue series, gap-filled so the chart has one bar per day. */
export async function getDailySales(range: DateRange): Promise<SeriesPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ day: Date; total: bigint | number }>>`
    SELECT date_trunc('day', "placedAt") AS day, COALESCE(SUM("grandTotal"), 0) AS total
    FROM orders
    WHERE "deletedAt" IS NULL
      AND "placedAt" BETWEEN ${range.from} AND ${range.to}
      AND status::text = ANY(${REVENUE_STATUSES})
    GROUP BY 1
    ORDER BY 1`;

  const byDay = new Map(
    rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), Number(row.total)]),
  );

  const series: SeriesPoint[] = [];
  const cursor = new Date(range.from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= range.to && series.length < 180) {
    const key = cursor.toISOString().slice(0, 10);
    series.push({ label: key.slice(5), value: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

export async function getOrderStatusBreakdown(range: DateRange): Promise<SeriesPoint[]> {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: { placedAt: { gte: range.from, lte: range.to }, deletedAt: null },
    _count: true,
  });
  return rows
    .map((row) => ({ label: ORDER_STATUS_LABELS[row.status], value: row._count }))
    .sort((a, b) => b.value - a.value);
}

export async function getPaymentMethodBreakdown(range: DateRange): Promise<SeriesPoint[]> {
  const rows = await prisma.order.groupBy({
    by: ["paymentMethod"],
    where: { placedAt: { gte: range.from, lte: range.to }, deletedAt: null },
    _count: true,
    _sum: { grandTotal: true },
  });
  return rows
    .map((row) => ({ label: humanizeEnum(row.paymentMethod), value: row._sum.grandTotal ?? 0 }))
    .sort((a, b) => b.value - a.value);
}

export async function getPaymentStatusBreakdown(range: DateRange): Promise<SeriesPoint[]> {
  const rows = await prisma.order.groupBy({
    by: ["paymentStatus"],
    where: { placedAt: { gte: range.from, lte: range.to }, deletedAt: null },
    _count: true,
  });
  return rows.map((row) => ({ label: PAYMENT_STATUS_LABELS[row.paymentStatus], value: row._count }));
}

export type TopProductRow = {
  productId: string | null;
  name: string;
  slug: string | null;
  quantity: number;
  revenue: number;
};

export async function getTopProducts(range: DateRange, limit = 10): Promise<TopProductRow[]> {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId", "productName", "productSlug"],
    where: {
      order: { placedAt: { gte: range.from, lte: range.to }, status: { in: REVENUE_STATUSES }, deletedAt: null },
    },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: limit,
  });

  return rows.map((row) => ({
    productId: row.productId,
    name: row.productName,
    slug: row.productSlug,
    quantity: row._sum.quantity ?? 0,
    revenue: row._sum.lineTotal ?? 0,
  }));
}

export async function getTopCustomers(range: DateRange, limit = 10) {
  const rows = await prisma.order.groupBy({
    by: ["userId", "customerName", "customerPhone"],
    where: {
      placedAt: { gte: range.from, lte: range.to },
      status: { in: REVENUE_STATUSES },
      deletedAt: null,
    },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { _sum: { grandTotal: "desc" } },
    take: limit,
  });

  return rows.map((row) => ({
    userId: row.userId,
    name: row.customerName,
    phone: row.customerPhone,
    orders: row._count,
    spend: row._sum.grandTotal ?? 0,
  }));
}

export async function getCouponPerformance(range: DateRange, limit = 20) {
  const rows = await prisma.couponRedemption.groupBy({
    by: ["couponId"],
    where: { createdAt: { gte: range.from, lte: range.to } },
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (rows.length === 0) return [];

  const coupons = await prisma.coupon.findMany({
    where: { id: { in: rows.map((row) => row.couponId) } },
    select: { id: true, code: true, title: true, discountType: true, discountValue: true },
  });
  const byId = new Map(coupons.map((coupon) => [coupon.id, coupon]));

  return rows.map((row) => ({
    couponId: row.couponId,
    code: byId.get(row.couponId)?.code ?? "—",
    title: byId.get(row.couponId)?.title ?? "",
    uses: row._count,
    discountGiven: row._sum.amount ?? 0,
  }));
}

export async function getLowStockProducts(limit = 20) {
  return prisma.$queryRaw<Array<{ id: string; name: string; slug: string; stock: number; lowStockThreshold: number }>>`
    SELECT id, name, slug, stock, "lowStockThreshold"
    FROM products
    WHERE "deletedAt" IS NULL AND status = 'PUBLISHED' AND "hasVariants" = false
      AND stock <= "lowStockThreshold"
    ORDER BY stock ASC
    LIMIT ${limit}`;
}

export async function getRecentOrders(limit = 8) {
  return prisma.order.findMany({
    where: { deletedAt: null },
    orderBy: { placedAt: "desc" },
    take: limit,
    select: {
      id: true, orderNumber: true, customerName: true, status: true, paymentStatus: true,
      grandTotal: true, placedAt: true, districtName: true,
    },
  });
}

/** Returns/refunds report. */
export async function getReturnsReport(range: DateRange) {
  const [returns, refunds] = await Promise.all([
    prisma.returnRequest.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, reason: true, status: true, quantity: true, createdAt: true,
        order: { select: { id: true, orderNumber: true, customerName: true } },
      },
    }),
    prisma.refund.aggregate({
      where: { createdAt: { gte: range.from, lte: range.to }, status: "PROCESSED" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    returns,
    refundTotal: refunds._sum.amount ?? 0,
    refundCount: refunds._count,
  };
}

/** Filter helper shared by the order list and reports. */
export function orderWhereFromFilters(filters: {
  q?: string;
  status?: string;
  /** Queue tab: several statuses at once, e.g. everything waiting to be packed. */
  statuses?: readonly OrderStatus[];
  paymentStatus?: string;
  paymentMethod?: string;
  districtId?: string;
  from?: Date;
  to?: Date;
  flagged?: boolean;
}): Prisma.OrderWhereInput {
  return {
    deletedAt: null,
    // An explicit status filter is narrower than the queue, so it wins.
    ...(filters.status
      ? { status: filters.status as OrderStatus }
      : filters.statuses && filters.statuses.length > 0
        ? { status: { in: [...filters.statuses] } }
        : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus as never } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod as never } : {}),
    ...(filters.districtId ? { districtId: filters.districtId } : {}),
    ...(filters.flagged ? { isFlagged: true } : {}),
    ...(filters.from || filters.to
      ? { placedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { orderNumber: { contains: filters.q, mode: "insensitive" } },
            { customerName: { contains: filters.q, mode: "insensitive" } },
            { customerPhone: { contains: filters.q } },
            { customerEmail: { contains: filters.q, mode: "insensitive" } },
            { items: { some: { productName: { contains: filters.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}
