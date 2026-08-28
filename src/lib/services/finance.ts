import "server-only";

import { prisma } from "@/lib/db";
import { errors } from "@/lib/api";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionKind } from "@/generated/prisma/enums";
import { getSettingGroup } from "@/lib/settings";
import { generateReference } from "@/lib/ids";

/**
 * The books.
 *
 * Two rules shape everything here.
 *
 * First, `amount` is always positive and `kind` carries the direction. Signed
 * amounts invite a bug where an expense is entered as a negative income and
 * quietly cancels a sale — the totals still balance, and nobody can see why
 * profit moved.
 *
 * Second, nothing is ever hard-deleted. A wrong entry is voided, which leaves
 * both the original row and the reason in place, and every edit writes a
 * revision. An accountant who cannot see what a number used to be cannot
 * audit it.
 */

export type FinanceActor = { id: string | null; name: string | null; role: string | null };

export type PostTransactionInput = {
  kind: TransactionKind;
  /** Category by slug, so callers need not know its id. */
  categorySlug?: string;
  categoryId?: string;
  accountCode?: string;
  accountId?: string;
  /** Positive minor units. */
  amount: number;
  description: string;
  occurredAt?: Date;
  paymentMethod?: string | null;
  vendorName?: string | null;
  employeeId?: string | null;
  orderId?: string | null;
  shipmentId?: string | null;
  attachmentUrl?: string | null;
  note?: string | null;
  isAutomatic?: boolean;
  actor: FinanceActor;
};

export async function postTransaction(input: PostTransactionInput): Promise<string> {
  const amount = Math.round(input.amount);
  if (amount <= 0) throw errors.validation("Enter an amount greater than zero.");
  if (!input.description.trim()) throw errors.validation("Describe what this is for.");

  const [category, account] = await Promise.all([
    input.categoryId
      ? prisma.expenseCategory.findUnique({ where: { id: input.categoryId }, select: { id: true, kind: true } })
      : input.categorySlug
        ? prisma.expenseCategory.findUnique({ where: { slug: input.categorySlug }, select: { id: true, kind: true } })
        : Promise.resolve(null),
    input.accountId
      ? prisma.financeAccount.findUnique({ where: { id: input.accountId }, select: { id: true } })
      : input.accountCode
        ? prisma.financeAccount.findUnique({ where: { code: input.accountCode }, select: { id: true } })
        : Promise.resolve(null),
  ]);

  // A category filed under the wrong side of the books makes every report
  // wrong, so it is checked here rather than trusted from the form.
  if (category && input.kind !== "TRANSFER" && category.kind !== input.kind) {
    throw errors.validation("That category belongs to the other side of the books.");
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.financeTransaction.create({
      data: {
        reference: generateReference("TXN"),
        kind: input.kind,
        categoryId: category?.id ?? null,
        accountId: account?.id ?? null,
        amount,
        occurredAt: input.occurredAt ?? new Date(),
        description: input.description.trim().slice(0, 500),
        paymentMethod: input.paymentMethod ?? null,
        vendorName: input.vendorName ?? null,
        employeeId: input.employeeId ?? null,
        orderId: input.orderId ?? null,
        shipmentId: input.shipmentId ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        note: input.note ?? null,
        isAutomatic: input.isAutomatic ?? false,
        createdById: input.actor.id,
      },
      select: { id: true, reference: true, amount: true, kind: true, description: true },
    });

    await tx.financeTransactionRevision.create({
      data: {
        transactionId: created.id,
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: "create",
        after: created as unknown as Prisma.InputJsonValue,
      },
    });

    return created;
  });

  return transaction.id;
}

export type UpdateTransactionInput = {
  id: string;
  categoryId?: string | null;
  accountId?: string | null;
  amount: number;
  description: string;
  occurredAt: Date;
  paymentMethod?: string | null;
  vendorName?: string | null;
  employeeId?: string | null;
  attachmentUrl?: string | null;
  note?: string | null;
  actor: FinanceActor;
};

export async function updateTransaction(input: UpdateTransactionInput): Promise<void> {
  const before = await prisma.financeTransaction.findUnique({ where: { id: input.id } });
  if (!before) throw errors.notFound("That transaction no longer exists.");
  if (before.voidedAt) throw errors.validation("A voided transaction cannot be edited. Post a correcting entry.");

  const amount = Math.round(input.amount);
  if (amount <= 0) throw errors.validation("Enter an amount greater than zero.");

  await prisma.$transaction(async (tx) => {
    const after = await tx.financeTransaction.update({
      where: { id: input.id },
      data: {
        categoryId: input.categoryId ?? null,
        accountId: input.accountId ?? null,
        amount,
        description: input.description.trim().slice(0, 500),
        occurredAt: input.occurredAt,
        paymentMethod: input.paymentMethod ?? null,
        vendorName: input.vendorName ?? null,
        employeeId: input.employeeId ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        note: input.note ?? null,
        updatedById: input.actor.id,
      },
    });

    await tx.financeTransactionRevision.create({
      data: {
        transactionId: input.id,
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: "update",
        before: before as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
      },
    });
  });
}

/**
 * Cancels a transaction without erasing it.
 *
 * Reports skip voided rows, but the row and its reason stay, so "why did last
 * month's profit change?" always has an answer.
 */
export async function voidTransaction(id: string, reason: string, actor: FinanceActor): Promise<void> {
  const before = await prisma.financeTransaction.findUnique({ where: { id } });
  if (!before) throw errors.notFound("That transaction no longer exists.");
  if (before.voidedAt) throw errors.validation("That transaction is already voided.");
  if (reason.trim().length < 5) throw errors.validation("Say why this is being voided — at least a few words.");

  await prisma.$transaction(async (tx) => {
    const after = await tx.financeTransaction.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: actor.id, voidReason: reason.trim().slice(0, 300) },
    });
    await tx.financeTransactionRevision.create({
      data: {
        transactionId: id,
        actorId: actor.id,
        actorName: actor.name,
        action: "void",
        before: before as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
      },
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Reporting                                                                  */
/* -------------------------------------------------------------------------- */

/** Voided rows are excluded everywhere, without each caller remembering to. */
const LIVE: Prisma.FinanceTransactionWhereInput = { voidedAt: null };

export type FinanceSummary = {
  income: number;
  expense: number;
  netProfit: number;
  /** Revenue booked from orders, whether or not the money has arrived. */
  orderRevenue: number;
  productCost: number;
  courierCost: number;
  grossProfit: number;
  /** Cash the courier is holding that we have not been paid yet. */
  courierReceivable: number;
  pendingCod: number;
};

export async function getFinanceSummary(range: { from: Date; to: Date }): Promise<FinanceSummary> {
  const window: Prisma.FinanceTransactionWhereInput = {
    ...LIVE,
    occurredAt: { gte: range.from, lte: range.to },
  };

  const [income, expense, byCategory, receivable, pendingCod] = await Promise.all([
    prisma.financeTransaction.aggregate({ where: { ...window, kind: "INCOME" }, _sum: { amount: true } }),
    prisma.financeTransaction.aggregate({ where: { ...window, kind: "EXPENSE" }, _sum: { amount: true } }),
    // Transfers move money we have already counted, so they are excluded from
    // every category total — including this one, which feeds gross profit.
    prisma.financeTransaction.groupBy({
      by: ["categoryId"],
      where: { ...window, kind: { in: ["INCOME", "EXPENSE"] } },
      _sum: { amount: true },
    }),
    // What couriers have collected but not yet paid over.
    prisma.shipment.aggregate({
      where: { settlementStatus: { in: ["PENDING", "PARTIAL"] }, collectedAmount: { gt: 0 } },
      _sum: { collectedAmount: true, settledAmount: true },
    }),
    prisma.order.aggregate({
      where: { deletedAt: null, paymentMethod: "COD", paymentStatus: { in: ["UNPAID", "PENDING", "PARTIALLY_PAID"] }, status: { notIn: ["CANCELLED", "REJECTED", "FAILED"] } },
      _sum: { grandTotal: true, paidTotal: true },
    }),
  ]);

  const categories = await prisma.expenseCategory.findMany({ select: { id: true, slug: true } });
  const slugById = new Map(categories.map((category) => [category.id, category.slug]));
  const sumFor = (slug: string) =>
    byCategory
      .filter((row) => row.categoryId && slugById.get(row.categoryId) === slug)
      .reduce((total, row) => total + (row._sum.amount ?? 0), 0);

  const totalIncome = income._sum?.amount ?? 0;
  const totalExpense = expense._sum?.amount ?? 0;
  const productCost = sumFor("product-cost");
  const courierCost = sumFor("courier-charge");
  const orderRevenue = sumFor("product-sales") + sumFor("delivery-income");

  return {
    income: totalIncome,
    expense: totalExpense,
    netProfit: totalIncome - totalExpense,
    orderRevenue,
    productCost,
    courierCost,
    grossProfit: orderRevenue - productCost - courierCost,
    courierReceivable: Math.max(
      0,
      (receivable._sum?.collectedAmount ?? 0) - (receivable._sum?.settledAmount ?? 0),
    ),
    pendingCod: Math.max(0, (pendingCod._sum?.grandTotal ?? 0) - (pendingCod._sum?.paidTotal ?? 0)),
  };
}

export type CategoryTotal = { id: string | null; name: string; slug: string | null; kind: TransactionKind | null; total: number; count: number };

export async function getCategoryTotals(
  range: { from: Date; to: Date },
  kind?: TransactionKind,
): Promise<CategoryTotal[]> {
  const grouped = await prisma.financeTransaction.groupBy({
    by: ["categoryId"],
    where: {
      ...LIVE,
      occurredAt: { gte: range.from, lte: range.to },
      // Transfers are movements of money already counted, never a category line.
      ...(kind ? { kind } : { kind: { in: ["INCOME", "EXPENSE"] } }),
    },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const categories = await prisma.expenseCategory.findMany({
    select: { id: true, name: true, slug: true, kind: true },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));

  return grouped
    .map((row) => {
      const category = row.categoryId ? byId.get(row.categoryId) : undefined;
      return {
        id: row.categoryId,
        name: category?.name ?? "Uncategorised",
        slug: category?.slug ?? null,
        kind: category?.kind ?? null,
        total: row._sum.amount ?? 0,
        count: row._count._all,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type CashFlowPoint = { date: string; income: number; expense: number; net: number };

/**
 * Daily money in and out.
 *
 * Grouped in SQL rather than in JavaScript: a year of transactions is a lot of
 * rows to pull across just to bucket them by day.
 */
export async function getCashFlow(range: { from: Date; to: Date }): Promise<CashFlowPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ day: Date; kind: TransactionKind; total: bigint }>>`
    SELECT date_trunc('day', "occurredAt") AS day, "kind", SUM("amount")::bigint AS total
    FROM "finance_transactions"
    WHERE "voidedAt" IS NULL
      AND "occurredAt" >= ${range.from} AND "occurredAt" <= ${range.to}
      -- Cash flow shows money earned and spent; a transfer is neither.
      AND "kind" IN ('INCOME', 'EXPENSE')
    GROUP BY day, "kind"
    ORDER BY day ASC
  `;

  const byDay = new Map<string, CashFlowPoint>();
  for (const row of rows) {
    const date = row.day.toISOString().slice(0, 10);
    const point = byDay.get(date) ?? { date, income: 0, expense: 0, net: 0 };
    if (row.kind === "INCOME") point.income += Number(row.total);
    if (row.kind === "EXPENSE") point.expense += Number(row.total);
    point.net = point.income - point.expense;
    byDay.set(date, point);
  }
  return [...byDay.values()];
}

export type AccountBalance = { id: string; name: string; code: string; type: string; balance: number };

/**
 * Balances, derived from opening balance plus movements.
 *
 * `currentBalance` is not stored: a running total maintained by hand drifts
 * the first time a transaction is voided and nobody remembers to adjust it.
 */
export async function getAccountBalances(): Promise<AccountBalance[]> {
  const [accounts, grouped] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, type: true, openingBalance: true },
    }),
    prisma.financeTransaction.groupBy({
      by: ["accountId", "kind"],
      where: LIVE,
      _sum: { amount: true },
    }),
  ]);

  return accounts.map((account) => {
    const movement = grouped
      .filter((row) => row.accountId === account.id)
      .reduce((total, row) => {
        // A transfer names the account the money arrived IN, so it adds like
        // income. Only an expense leaves. Getting this wrong would show the
        // till going down every time a courier paid us.
        const direction = row.kind === "EXPENSE" ? -1 : 1;
        return total + direction * (row._sum.amount ?? 0);
      }, 0);
    return {
      id: account.id,
      name: account.name,
      code: account.code,
      type: account.type,
      balance: account.openingBalance + movement,
    };
  });
}

/**
 * Posts the revenue and cost lines for an order.
 *
 * Called when the order reaches whichever point the shop counts as a sale —
 * `revenueRecognition` decides whether that is placement or delivery. Idempotent
 * by order id, because a status change can be retried.
 */
export async function postOrderRevenue(orderId: string, actor: FinanceActor): Promise<void> {
  const settings = await getSettingGroup("finance");

  const existing = await prisma.financeTransaction.findFirst({
    where: { orderId, isAutomatic: true, kind: "INCOME", voidedAt: null },
    select: { id: true },
  });
  if (existing) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, subtotal: true, shippingTotal: true, grandTotal: true,
      items: { select: { quantity: true, productId: true, variantId: true } },
    },
  });
  if (!order) return;

  await postTransaction({
    kind: "INCOME",
    categorySlug: "product-sales",
    amount: order.subtotal,
    description: `Sale — order ${order.orderNumber}`,
    orderId: order.id,
    isAutomatic: true,
    actor,
  });

  if (order.shippingTotal > 0) {
    await postTransaction({
      kind: "INCOME",
      categorySlug: "delivery-income",
      amount: order.shippingTotal,
      description: `Delivery charge — order ${order.orderNumber}`,
      orderId: order.id,
      isAutomatic: true,
      actor,
    });
  }

  if (settings.trackCostOfGoods) {
    const cost = await orderCost(order.items);
    if (cost > 0) {
      await postTransaction({
        kind: "EXPENSE",
        categorySlug: "product-cost",
        amount: cost,
        description: `Cost of goods — order ${order.orderNumber}`,
        orderId: order.id,
        isAutomatic: true,
        actor,
      });
    }
  }

  if (settings.packagingCostPerOrder > 0) {
    await postTransaction({
      kind: "EXPENSE",
      categorySlug: "packaging",
      amount: settings.packagingCostPerOrder,
      description: `Packaging — order ${order.orderNumber}`,
      orderId: order.id,
      isAutomatic: true,
      actor,
    });
  }
}

/** What the goods on an order cost us, from the product/variant cost prices. */
async function orderCost(
  items: Array<{ quantity: number; productId: string | null; variantId: string | null }>,
): Promise<number> {
  const productIds = items.map((item) => item.productId).filter((id): id is string => Boolean(id));
  const variantIds = items.map((item) => item.variantId).filter((id): id is string => Boolean(id));

  const [products, variants] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, costPrice: true } })
      : Promise.resolve([]),
    variantIds.length
      ? prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, costPrice: true } })
      : Promise.resolve([]),
  ]);

  const productCost = new Map(products.map((product) => [product.id, product.costPrice ?? 0]));
  const variantCost = new Map(variants.map((variant) => [variant.id, variant.costPrice ?? 0]));

  return items.reduce((total, item) => {
    const unit = item.variantId
      ? variantCost.get(item.variantId) ?? 0
      : item.productId
        ? productCost.get(item.productId) ?? 0
        : 0;
    return total + unit * item.quantity;
  }, 0);
}
