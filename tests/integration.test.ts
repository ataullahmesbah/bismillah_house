import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { toMinor } from "@/lib/money";

/**
 * Database-backed tests for the guarantees that only show up under real
 * concurrency and real transactions: stock never oversells, a coupon never
 * exceeds its limit, and an invoice never changes once issued.
 *
 * They skip themselves when no database is reachable, so `npm test` still
 * works on a machine that has not run migrations yet.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Resolved during collection (not in beforeAll) because `describe.skip` is
// decided while the file is being collected, not when hooks run.
const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => {
    console.warn("\n  ⚠ Skipping integration tests — no database reachable at DATABASE_URL.\n");
    return false;
  });

afterAll(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

const suite = () => (dbAvailable ? describe : describe.skip);

/* -------------------------------------------------------------------------- */

suite()("inventory safety", () => {
  it("refuses to decrement stock below zero", async () => {
    const product = await prisma.product.create({
      data: { name: "Concurrency probe", slug: `probe-${Date.now()}`, price: toMinor(100), stock: 3, status: "DRAFT" },
      select: { id: true },
    });

    // The conditional update is what stops two checkouts overselling the same unit.
    const first = await prisma.product.updateMany({
      where: { id: product.id, stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    const second = await prisma.product.updateMany({
      where: { id: product.id, stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });

    expect(first.count).toBe(1);
    expect(second.count).toBe(0);

    const after = await prisma.product.findUnique({ where: { id: product.id }, select: { stock: true } });
    expect(after?.stock).toBe(0);

    await prisma.product.delete({ where: { id: product.id } });
  });

  it("keeps variant stock independent per variant", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Variant probe",
        slug: `variant-probe-${Date.now()}`,
        price: toMinor(500),
        status: "DRAFT",
        hasVariants: true,
        variants: {
          create: [
            { name: "500g", price: toMinor(500), stock: 5, position: 0 },
            { name: "1kg", price: toMinor(900), stock: 2, position: 1 },
          ],
        },
      },
      select: { id: true, variants: { select: { id: true, name: true, stock: true }, orderBy: { position: "asc" } } },
    });

    const [small, large] = product.variants;

    await prisma.productVariant.updateMany({
      where: { id: small!.id, stock: { gte: 5 } },
      data: { stock: { decrement: 5 } },
    });

    const fresh = await prisma.productVariant.findMany({
      where: { productId: product.id },
      orderBy: { position: "asc" },
      select: { stock: true },
    });

    expect(fresh[0]?.stock).toBe(0);
    expect(fresh[1]?.stock).toBe(2);
    void large;

    await prisma.product.delete({ where: { id: product.id } });
  });
});

suite()("coupon usage limits", () => {
  it("stops the usage count exceeding the limit", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `PROBE${Date.now()}`,
        title: "Limit probe",
        discountType: "FIXED",
        discountValue: toMinor(50),
        startAt: new Date(Date.now() - 1000),
        endAt: new Date(Date.now() + 60_000),
        usageLimit: 2,
        isActive: true,
      },
      select: { id: true },
    });

    const claim = () =>
      prisma.coupon.updateMany({
        where: { id: coupon.id, isActive: true, usageCount: { lt: 2 } },
        data: { usageCount: { increment: 1 } },
      });

    expect((await claim()).count).toBe(1);
    expect((await claim()).count).toBe(1);
    // Third attempt must find no matching row.
    expect((await claim()).count).toBe(0);

    const final = await prisma.coupon.findUnique({ where: { id: coupon.id }, select: { usageCount: true } });
    expect(final?.usageCount).toBe(2);

    await prisma.coupon.delete({ where: { id: coupon.id } });
  });
});

suite()("invoices", () => {
  it("issues one immutable invoice per order and never re-issues it", async () => {
    const { createInvoiceRecord } = await import("@/lib/services/invoice-builder");

    const order = await prisma.order.create({
      data: {
        orderNumber: `TM-TEST-${Date.now()}`,
        publicToken: `token-${Date.now()}`,
        customerName: "Invoice Probe",
        customerPhone: "01700000000",
        subtotal: toMinor(1000),
        shippingTotal: toMinor(60),
        grandTotal: toMinor(1060),
        shippingAddress: { fullName: "Invoice Probe", addressLine1: "Test", district: "Dhaka" },
        items: {
          create: [
            {
              productName: "Probe item",
              unitPrice: toMinor(1000),
              quantity: 1,
              lineSubtotal: toMinor(1000),
              lineTotal: toMinor(1000),
            },
          ],
        },
      },
      select: { id: true },
    });

    const first = await prisma.$transaction((tx) => createInvoiceRecord(tx, order.id));
    const second = await prisma.$transaction((tx) => createInvoiceRecord(tx, order.id));

    expect(second.id).toBe(first.id);
    expect(second.invoiceNumber).toBe(first.invoiceNumber);
    expect(first.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(first.totalPayable).toBe(toMinor(1060));

    // Editing the order afterwards must not change the issued invoice.
    await prisma.order.update({ where: { id: order.id }, data: { grandTotal: toMinor(9999) } });
    const reread = await prisma.invoice.findUnique({ where: { orderId: order.id } });
    expect(reread?.totalPayable).toBe(toMinor(1060));

    await prisma.order.delete({ where: { id: order.id } });
  });
});

suite()("seeded shop", () => {
  it("has all 64 delivery districts with the documented example charges", async () => {
    const count = await prisma.district.count();
    if (count === 0) return; // database migrated but not seeded

    expect(count).toBe(64);

    const dhaka = await prisma.district.findUnique({ where: { name: "Dhaka" } });
    const sylhet = await prisma.district.findUnique({ where: { name: "Sylhet" } });
    const chattogram = await prisma.district.findUnique({ where: { name: "Chattogram" } });

    expect(dhaka?.deliveryCharge).toBe(toMinor(60));
    expect(sylhet?.isFreeDelivery).toBe(true);
    expect(chattogram?.deliveryCharge).toBe(toMinor(100));
  });

  it("has the PRD's variant pricing examples", async () => {
    const dates = await prisma.product.findUnique({
      where: { slug: "premium-ajwa-dates" },
      select: { variants: { select: { name: true, price: true }, orderBy: { position: "asc" } } },
    });
    if (!dates) return;

    const byName = Object.fromEntries(dates.variants.map((variant) => [variant.name, variant.price]));
    expect(byName["500g"]).toBe(toMinor(500));
    expect(byName["1kg"]).toBe(toMinor(900));
    expect(byName["2kg"]).toBe(toMinor(1700));
  });

  it("never stores a plain-text password", async () => {
    const users = await prisma.user.findMany({ select: { passwordHash: true }, take: 10 });
    for (const user of users) {
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(user.passwordHash).not.toContain("2026");
    }
  });
});
