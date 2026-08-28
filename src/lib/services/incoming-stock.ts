import "server-only";

import { prisma } from "@/lib/db";
import { errors } from "@/lib/api";

/**
 * Stock on its way in from a supplier.
 *
 * Expected quantities are informational — they raise `stockIncoming` so the
 * dashboard can say "20 more arriving Thursday" without ever letting anyone
 * sell them. Only receiving turns them into sellable stock, and receiving is a
 * deliberate act with a ledger entry behind it.
 */

export type IncomingLineInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitCost: number;
};

export type CreateIncomingInput = {
  reference: string;
  supplierName: string;
  supplierPhone?: string | null;
  warehouseId?: string | null;
  expectedAt?: Date | null;
  shippingCost?: number;
  note?: string | null;
  lines: IncomingLineInput[];
  actorId: string;
};

export async function createIncomingStock(input: CreateIncomingInput): Promise<string> {
  const lines = input.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) throw errors.validation("Add at least one product to receive.");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.stockIncoming.findUnique({
      where: { reference: input.reference },
      select: { id: true },
    });
    if (existing) throw errors.validation("That reference is already used by another incoming shipment.");

    const incoming = await tx.stockIncoming.create({
      data: {
        reference: input.reference,
        supplierName: input.supplierName,
        supplierPhone: input.supplierPhone ?? null,
        warehouseId: input.warehouseId ?? null,
        expectedAt: input.expectedAt ?? null,
        shippingCost: input.shippingCost ?? 0,
        note: input.note ?? null,
        createdById: input.actorId,
        status: "EXPECTED",
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId ?? null,
            quantity: line.quantity,
            unitCost: line.unitCost,
          })),
        },
      },
      select: { id: true },
    });

    for (const line of lines) {
      if (line.variantId) {
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stockIncoming: { increment: line.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: line.productId },
          data: { stockIncoming: { increment: line.quantity } },
        });
      }
    }

    return incoming.id;
  });
}

/**
 * Books in what actually turned up.
 *
 * Suppliers short-ship, so each line records how many arrived rather than
 * assuming the order was filled. Whatever is still outstanding stays counted as
 * incoming until the shipment is closed.
 */
export async function receiveIncomingStock(
  incomingId: string,
  received: Array<{ itemId: string; quantity: number }>,
  actor: { id: string; name: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const incoming = await tx.stockIncoming.findUnique({
      where: { id: incomingId },
      select: {
        id: true, status: true, reference: true, warehouseId: true,
        items: { select: { id: true, productId: true, variantId: true, quantity: true, receivedQuantity: true, unitCost: true } },
      },
    });
    if (!incoming) throw errors.notFound("That incoming shipment no longer exists.");
    if (incoming.status === "CANCELLED") throw errors.validation("That shipment was cancelled.");
    if (incoming.status === "RECEIVED") throw errors.validation("That shipment is already fully received.");

    const byId = new Map(incoming.items.map((item) => [item.id, item]));

    for (const entry of received) {
      const item = byId.get(entry.itemId);
      if (!item) continue;

      const outstanding = item.quantity - item.receivedQuantity;
      const quantity = Math.min(Math.max(0, Math.trunc(entry.quantity)), outstanding);
      if (quantity === 0) continue;

      const target = item.variantId
        ? await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: quantity },
              stockIncoming: { decrement: quantity },
              costPrice: item.unitCost > 0 ? item.unitCost : undefined,
              lastRestockedAt: new Date(),
            },
            select: { stock: true },
          })
        : await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: quantity },
              stockIncoming: { decrement: quantity },
              costPrice: item.unitCost > 0 ? item.unitCost : undefined,
              lastRestockedAt: new Date(),
            },
            select: { stock: true },
          });

      await tx.stockIncomingItem.update({
        where: { id: item.id },
        data: { receivedQuantity: { increment: quantity } },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: incoming.warehouseId,
          type: "RECEIVED",
          quantityChange: quantity,
          quantityAfter: target.stock,
          unitCost: item.unitCost,
          reason: `Received against ${incoming.reference}`,
          referenceType: "incoming",
          referenceId: incoming.id,
          actorId: actor.id,
          actorName: actor.name,
        },
      });
    }

    const fresh = await tx.stockIncomingItem.findMany({
      where: { incomingId },
      select: { quantity: true, receivedQuantity: true },
    });
    const complete = fresh.every((item) => item.receivedQuantity >= item.quantity);
    const started = fresh.some((item) => item.receivedQuantity > 0);

    await tx.stockIncoming.update({
      where: { id: incomingId },
      data: {
        status: complete ? "RECEIVED" : started ? "PARTIAL" : "EXPECTED",
        receivedAt: complete ? new Date() : null,
      },
    });
  });
}

/** Abandons a shipment and stops counting it towards incoming stock. */
export async function cancelIncomingStock(incomingId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const incoming = await tx.stockIncoming.findUnique({
      where: { id: incomingId },
      select: {
        status: true,
        items: { select: { productId: true, variantId: true, quantity: true, receivedQuantity: true } },
      },
    });
    if (!incoming) throw errors.notFound("That incoming shipment no longer exists.");
    if (incoming.status === "CANCELLED") return;

    // Only what never arrived is taken back off the incoming tally.
    for (const item of incoming.items) {
      const outstanding = item.quantity - item.receivedQuantity;
      if (outstanding <= 0) continue;
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockIncoming: { decrement: outstanding } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockIncoming: { decrement: outstanding } },
        });
      }
    }

    await tx.stockIncoming.update({ where: { id: incomingId }, data: { status: "CANCELLED" } });
  });
}
