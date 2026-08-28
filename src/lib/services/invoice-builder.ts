/**
 * Invoice snapshot + record creation.
 *
 * Deliberately free of server-only imports so the seed script can produce the
 * same immutable invoices the application does.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";

export type InvoiceSnapshot = {
  invoiceNumber: string;
  issuedAt: string;
  order: {
    orderNumber: string;
    placedAt: string;
    status: OrderStatus;
    paymentStatus: string;
    paymentMethod: string;
    customerNote: string | null;
  };
  customer: { name: string; phone: string; email: string | null };
  shippingAddress: Record<string, unknown>;
  items: Array<{
    name: string;
    variantName: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineSubtotal: number;
    lineTotal: number;
  }>;
  totals: {
    subtotal: number;
    itemDiscount: number;
    offerDiscount: number;
    couponDiscount: number;
    totalDiscount: number;
    shipping: number;
    grandTotal: number;
    currency: string;
  };
  coupon: { code: string; discount: number } | null;
  shipping: Record<string, unknown> | null;
};

type TxClient = Prisma.TransactionClient;

/** `INV-2026-000123` — unique and immutable once issued. */
export function formatInvoiceNumber(sequence: number, now = new Date()): string {
  return `INV-${now.getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}

/** Reserves the next invoice number from a Postgres sequence (atomic). */
async function nextInvoiceNumber(tx: TxClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('invoice_number_seq')`;
  return formatInvoiceNumber(Number(rows[0]?.nextval ?? 1));
}

/**
 * Builds and stores the immutable invoice for an order.
 * Returns the existing invoice untouched if one was already issued — an
 * invoice must never change after the fact.
 */
export async function createInvoiceRecord(tx: TxClient, orderId: string, generatedById?: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error(`Cannot create an invoice: order ${orderId} not found.`);

  const existing = await tx.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const invoiceNumber = await nextInvoiceNumber(tx);

  const snapshot: InvoiceSnapshot = {
    invoiceNumber,
    issuedAt: new Date().toISOString(),
    order: {
      orderNumber: order.orderNumber,
      placedAt: order.placedAt.toISOString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      customerNote: order.customerNote,
    },
    customer: { name: order.customerName, phone: order.customerPhone, email: order.customerEmail },
    shippingAddress: (order.shippingAddress ?? {}) as Record<string, unknown>,
    items: order.items.map((item) => ({
      name: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discountAmount,
      lineSubtotal: item.lineSubtotal,
      lineTotal: item.lineTotal,
    })),
    totals: {
      subtotal: order.subtotal,
      itemDiscount: order.itemDiscountTotal,
      offerDiscount: order.offerDiscount,
      couponDiscount: order.couponDiscount,
      totalDiscount: order.itemDiscountTotal + order.offerDiscount + order.couponDiscount,
      shipping: order.shippingTotal,
      grandTotal: order.grandTotal,
      currency: order.currency,
    },
    coupon: order.couponCode ? { code: order.couponCode, discount: order.couponDiscount } : null,
    shipping: (order.shippingSnapshot ?? null) as Record<string, unknown> | null,
  };

  return tx.invoice.create({
    data: {
      orderId,
      invoiceNumber,
      currency: order.currency,
      totalPayable: order.grandTotal,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      generatedById: generatedById ?? null,
    },
  });
}
