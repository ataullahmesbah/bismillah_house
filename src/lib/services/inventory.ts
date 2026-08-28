import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { InventoryMovementType } from "@/generated/prisma/enums";
import { errors } from "@/lib/api";
import { getSettingGroup } from "@/lib/settings";
import {
  ADJUSTMENT_REASONS,
  type AdjustmentReason,
} from "./inventory.shared";

export { ADJUSTMENT_REASONS, ADJUSTMENT_REASON_KEYS, isAdjustmentReason, MOVEMENT_TYPE_LABELS } from "./inventory.shared";
export type { AdjustmentReason } from "./inventory.shared";

/**
 * Stock arithmetic for the whole shop.
 *
 * Three numbers, and it matters which is which:
 *
 *   available = `stock`          — sellable this second
 *   reserved  = `stockReserved`  — promised to orders still in the building
 *   on hand   = available + reserved
 *
 * `stock` is the *available* figure rather than the on-hand one because that is
 * what the oversell guard compares against: checkout does a conditional
 * `updateMany` on `stock >= quantity`, which is atomic in Postgres and needs no
 * lock. Storing on-hand there instead would mean every checkout had to read
 * reservations first and race with the next shopper.
 *
 * Per-warehouse balances are deliberately NOT counters. They are summed from
 * the movement ledger on demand, so they can never disagree with the movements
 * that produced them.
 */

export type StockSnapshot = {
  available: number;
  reserved: number;
  onHand: number;
  damaged: number;
  incoming: number;
};

export function stockSnapshot(row: {
  stock: number;
  stockReserved: number;
  stockDamaged: number;
  stockIncoming: number;
}): StockSnapshot {
  return {
    available: row.stock,
    reserved: row.stockReserved,
    onHand: row.stock + row.stockReserved,
    damaged: row.stockDamaged,
    incoming: row.stockIncoming,
  };
}

/** A movement type that means "somebody wrote this off", for the damaged tally. */
const WRITE_OFF_TYPES: InventoryMovementType[] = ["DAMAGED", "LOST", "EXPIRED"];

export type AdjustInput = {
  productId: string;
  variantId?: string | null;
  reason: AdjustmentReason;
  /** Signed. The reason decides which signs are legal. */
  quantity: number;
  warehouseId?: string | null;
  /** Second warehouse, for a transfer. */
  toWarehouseId?: string | null;
  note?: string | null;
  unitCost?: number | null;
  actor: { id: string; name: string | null };
};

/**
 * Applies one manual stock adjustment and writes its ledger entry.
 *
 * Runs in a transaction so the counter and the movement can never disagree,
 * and refuses to drive available stock below zero unless the shop has
 * explicitly allowed negative stock.
 */
export async function adjustStock(input: AdjustInput): Promise<{ quantityAfter: number }> {
  const rule = ADJUSTMENT_REASONS[input.reason];
  const quantity = Math.trunc(input.quantity);

  if (quantity === 0) throw errors.validation("Enter a quantity to adjust by.");
  if (rule.delta === "increase" && quantity < 0) {
    throw errors.validation(`"${rule.label}" adds stock, so the quantity must be positive.`);
  }
  if (rule.delta === "decrease" && quantity > 0) {
    throw errors.validation(`"${rule.label}" removes stock, so enter how many to remove.`);
  }
  if (input.reason === "TRANSFER" && (!input.warehouseId || !input.toWarehouseId)) {
    throw errors.validation("A transfer needs both a source and a destination warehouse.");
  }
  if (input.reason === "TRANSFER" && input.warehouseId === input.toWarehouseId) {
    throw errors.validation("Pick two different warehouses to transfer between.");
  }

  // A decrease is entered as a positive number in the form and negated here,
  // because "damaged: -3" is a confusing thing to ask someone to type.
  const change = rule.delta === "decrease" ? -Math.abs(quantity) : quantity;

  const settings = await getSettingGroup("inventory");
  const isWriteOff = WRITE_OFF_TYPES.includes(rule.type);
  // Moving stock between our own warehouses does not change how much of it we
  // can sell, so a transfer writes two ledger lines and leaves the counter be.
  const isTransfer = input.reason === "TRANSFER";

  return prisma.$transaction(async (tx) => {
    const target = input.variantId
      ? await tx.productVariant.findUnique({
          where: { id: input.variantId },
          select: { id: true, productId: true, stock: true, name: true },
        })
      : await tx.product.findUnique({
          where: { id: input.productId },
          select: { id: true, stock: true, name: true },
        });

    if (!target) throw errors.notFound("That product is no longer available.");

    const nextStock = isTransfer ? target.stock : target.stock + change;
    if (nextStock < 0 && !settings.allowNegativeStock) {
      throw errors.validation(
        `${target.name} only has ${target.stock} available, so ${Math.abs(change)} cannot be removed.`,
      );
    }

    // Damage and loss move units out of "available" but they are still on the
    // shelf, so they are counted separately rather than simply vanishing.
    const damagedDelta = isWriteOff ? Math.abs(change) : 0;
    const restocked = change > 0 && !isTransfer ? { lastRestockedAt: new Date() } : {};

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: { stock: nextStock, stockDamaged: { increment: damagedDelta }, ...restocked },
      });
    } else {
      await tx.product.update({
        where: { id: input.productId },
        data: { stock: nextStock, stockDamaged: { increment: damagedDelta }, ...restocked },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId ?? null,
        type: rule.type,
        quantityChange: change,
        quantityAfter: nextStock,
        unitCost: input.unitCost ?? null,
        reason: input.note?.trim() || rule.label,
        referenceType: "adjustment",
        actorId: input.actor.id,
        actorName: input.actor.name,
      },
    });

    // A transfer is two ledger lines: it leaves one warehouse and arrives in
    // another. Total stock is unchanged, which is why the counter above only
    // moved once — the second line carries the same `quantityAfter`.
    if (isTransfer && input.toWarehouseId) {
      await tx.inventoryMovement.create({
        data: {
          productId: input.productId,
          variantId: input.variantId ?? null,
          warehouseId: input.toWarehouseId,
          type: "TRANSFER_IN",
          quantityChange: Math.abs(change),
          quantityAfter: nextStock,
          reason: input.note?.trim() || "Warehouse transfer in",
          referenceType: "adjustment",
          actorId: input.actor.id,
          actorName: input.actor.name,
        },
      });
    }

    return { quantityAfter: nextStock };
  });
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export type InventoryTotals = {
  totalProducts: number;
  totalVariants: number;
  onHandUnits: number;
  availableUnits: number;
  reservedUnits: number;
  damagedUnits: number;
  incomingUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  /** Sum of available units × unit cost, in minor units. */
  stockValueCost: number;
  stockValueRetail: number;
};

/**
 * The Overview numbers.
 *
 * Valuation is summed in the database rather than by loading every product,
 * because a catalogue of any size makes that the difference between a page and
 * a timeout.
 */
export async function getInventoryTotals(): Promise<InventoryTotals> {
  const live: Prisma.ProductWhereInput = { deletedAt: null };

  const [products, aggregate, variantAggregate, variantCount, lowStock, outOfStock, valuation] =
    await Promise.all([
      prisma.product.count({ where: live }),
      prisma.product.aggregate({
        where: { ...live, hasVariants: false },
        _sum: { stock: true, stockReserved: true, stockDamaged: true, stockIncoming: true },
      }),
      prisma.productVariant.aggregate({
        where: { product: live },
        _sum: { stock: true, stockReserved: true, stockDamaged: true, stockIncoming: true },
      }),
      prisma.productVariant.count({ where: { product: live } }),
      countLowStock(),
      prisma.product.count({ where: { ...live, hasVariants: false, stock: { lte: 0 } } }),
      stockValue(),
    ]);

  const sum = (a: number | null | undefined, b: number | null | undefined) => (a ?? 0) + (b ?? 0);
  const available = sum(aggregate._sum.stock, variantAggregate._sum.stock);
  const reserved = sum(aggregate._sum.stockReserved, variantAggregate._sum.stockReserved);

  return {
    totalProducts: products,
    totalVariants: variantCount,
    availableUnits: available,
    reservedUnits: reserved,
    onHandUnits: available + reserved,
    damagedUnits: sum(aggregate._sum.stockDamaged, variantAggregate._sum.stockDamaged),
    incomingUnits: sum(aggregate._sum.stockIncoming, variantAggregate._sum.stockIncoming),
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    stockValueCost: valuation.cost,
    stockValueRetail: valuation.retail,
  };
}

/**
 * Low stock means "at or below this product's own threshold, but not yet
 * zero" — an empty shelf is a different, louder problem and has its own tile.
 *
 * Prisma cannot compare two columns in a `where`, so this is raw SQL. The
 * values are interpolated by the tagged template, which parameterises them.
 */
async function countLowStock(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "products"
    WHERE "deletedAt" IS NULL
      AND "hasVariants" = false
      AND "stock" > 0
      AND "stock" <= "lowStockThreshold"
  `;
  return Number(rows[0]?.count ?? 0);
}

async function stockValue(): Promise<{ cost: number; retail: number }> {
  const rows = await prisma.$queryRaw<Array<{ cost: bigint | null; retail: bigint | null }>>`
    SELECT
      COALESCE(SUM("stock" * COALESCE("costPrice", 0)), 0)::bigint AS cost,
      COALESCE(SUM("stock" * "price"), 0)::bigint AS retail
    FROM "products"
    WHERE "deletedAt" IS NULL AND "hasVariants" = false
  `;
  const variants = await prisma.$queryRaw<Array<{ cost: bigint | null; retail: bigint | null }>>`
    SELECT
      COALESCE(SUM(v."stock" * COALESCE(v."costPrice", 0)), 0)::bigint AS cost,
      COALESCE(SUM(v."stock" * v."price"), 0)::bigint AS retail
    FROM "product_variants" v
    JOIN "products" p ON p."id" = v."productId"
    WHERE p."deletedAt" IS NULL
  `;
  return {
    cost: Number(rows[0]?.cost ?? 0) + Number(variants[0]?.cost ?? 0),
    retail: Number(rows[0]?.retail ?? 0) + Number(variants[0]?.retail ?? 0),
  };
}

export type StockRow = {
  id: string;
  productId: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  categoryName: string | null;
  available: number;
  reserved: number;
  onHand: number;
  damaged: number;
  incoming: number;
  lowStockThreshold: number;
  reorderLevel: number;
  costPrice: number | null;
  price: number;
  lastRestockedAt: Date | null;
  updatedAt: Date;
};

export type StockFilter = "all" | "low" | "out" | "reserved";

/** Products without variants — the ones whose own counter is the stock. */
export async function listProductStock(options: {
  q?: string;
  filter?: StockFilter;
  categoryId?: string;
  skip?: number;
  take?: number;
}): Promise<{ rows: StockRow[]; total: number }> {
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    hasVariants: false,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.q
      ? {
          OR: [
            { name: { contains: options.q, mode: "insensitive" } },
            { sku: { contains: options.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(options.filter === "out" ? { stock: { lte: 0 } } : {}),
    ...(options.filter === "reserved" ? { stockReserved: { gt: 0 } } : {}),
  };

  // "Low" needs a column-to-column comparison Prisma has no operator for, so
  // the matching ids are found in SQL first and fed back in as a filter.
  if (options.filter === "low") {
    const lowIds = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "products"
      WHERE "deletedAt" IS NULL AND "hasVariants" = false
        AND "stock" > 0 AND "stock" <= "lowStockThreshold"
    `;
    where.id = { in: lowIds.map((row) => row.id) };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      skip: options.skip ?? 0,
      take: options.take ?? 25,
      select: {
        id: true, name: true, sku: true, stock: true, stockReserved: true, stockDamaged: true,
        stockIncoming: true, lowStockThreshold: true, reorderLevel: true, costPrice: true,
        price: true, lastRestockedAt: true, updatedAt: true,
        category: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    total,
    rows: products.map((product) => ({
      id: product.id,
      productId: product.id,
      name: product.name,
      variantName: null,
      sku: product.sku,
      categoryName: product.category?.name ?? null,
      available: product.stock,
      reserved: product.stockReserved,
      onHand: product.stock + product.stockReserved,
      damaged: product.stockDamaged,
      incoming: product.stockIncoming,
      lowStockThreshold: product.lowStockThreshold,
      reorderLevel: product.reorderLevel,
      costPrice: product.costPrice,
      price: product.price,
      lastRestockedAt: product.lastRestockedAt,
      updatedAt: product.updatedAt,
    })),
  };
}

/** Variants, whose stock lives on the variant rather than the product. */
export async function listVariantStock(options: {
  q?: string;
  filter?: StockFilter;
  skip?: number;
  take?: number;
}): Promise<{ rows: StockRow[]; total: number }> {
  const where: Prisma.ProductVariantWhereInput = {
    product: { deletedAt: null },
    ...(options.q
      ? {
          OR: [
            { name: { contains: options.q, mode: "insensitive" } },
            { sku: { contains: options.q, mode: "insensitive" } },
            { product: { name: { contains: options.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(options.filter === "out" ? { stock: { lte: 0 } } : {}),
    ...(options.filter === "reserved" ? { stockReserved: { gt: 0 } } : {}),
  };

  if (options.filter === "low") {
    const lowIds = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT v."id" FROM "product_variants" v
      JOIN "products" p ON p."id" = v."productId"
      WHERE p."deletedAt" IS NULL AND v."stock" > 0 AND v."stock" <= v."lowStockThreshold"
    `;
    where.id = { in: lowIds.map((row) => row.id) };
  }

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      skip: options.skip ?? 0,
      take: options.take ?? 25,
      select: {
        id: true, name: true, sku: true, stock: true, stockReserved: true, stockDamaged: true,
        stockIncoming: true, lowStockThreshold: true, reorderLevel: true, costPrice: true,
        price: true, lastRestockedAt: true, updatedAt: true, productId: true,
        product: { select: { name: true, category: { select: { name: true } } } },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);

  return {
    total,
    rows: variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      name: variant.product.name,
      variantName: variant.name,
      sku: variant.sku,
      categoryName: variant.product.category?.name ?? null,
      available: variant.stock,
      reserved: variant.stockReserved,
      onHand: variant.stock + variant.stockReserved,
      damaged: variant.stockDamaged,
      incoming: variant.stockIncoming,
      lowStockThreshold: variant.lowStockThreshold,
      reorderLevel: variant.reorderLevel,
      costPrice: variant.costPrice,
      price: variant.price,
      lastRestockedAt: variant.lastRestockedAt,
      updatedAt: variant.updatedAt,
    })),
  };
}

/**
 * Per-warehouse balances, summed from the ledger.
 *
 * Derived rather than stored: a counter per warehouse would need every write
 * path to remember to update it, and the first one that forgets leaves numbers
 * that quietly disagree forever.
 */
export async function getWarehouseBalances(): Promise<
  Array<{ warehouseId: string | null; units: number; movements: number }>
> {
  const grouped = await prisma.inventoryMovement.groupBy({
    by: ["warehouseId"],
    _sum: { quantityChange: true },
    _count: { _all: true },
  });
  return grouped.map((row) => ({
    warehouseId: row.warehouseId,
    units: row._sum.quantityChange ?? 0,
    movements: row._count._all,
  }));
}

/** The warehouse adjustments land in when nobody picks one. */
export async function getDefaultWarehouseId(): Promise<string | null> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { position: "asc" }],
    select: { id: true },
  });
  return warehouse?.id ?? null;
}
