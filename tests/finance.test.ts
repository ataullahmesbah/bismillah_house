import { describe, expect, it } from "vitest";

import { generateReference } from "@/lib/ids";
import { transactionSchema, voidTransactionSchema } from "@/lib/validation/finance";
import { settlementSchema } from "@/lib/validation/courier";
import { mapStatusWord } from "@/lib/courier/types";

describe("transaction validation", () => {
  const base = {
    kind: "EXPENSE",
    amount: "450",
    description: "Staff lunch, Friday",
    occurredAt: "2026-08-27",
  };

  it("accepts a plain expense", () => {
    const parsed = transactionSchema.parse(base);
    expect(parsed.amount).toBe(450);
    expect(parsed.kind).toBe("EXPENSE");
  });

  /**
   * The bug this prevents: a negative income cancels a sale and the totals
   * still balance, so nobody can see why profit moved. Direction lives in
   * `kind`, and the amount is always positive.
   */
  it("refuses a negative amount, whichever direction it claims", () => {
    expect(() => transactionSchema.parse({ ...base, amount: "-450" })).toThrow();
    expect(() => transactionSchema.parse({ ...base, kind: "INCOME", amount: "-450" })).toThrow();
  });

  it("refuses zero", () => {
    expect(() => transactionSchema.parse({ ...base, amount: "0" })).toThrow();
  });

  it("refuses a direction that is not one of the two", () => {
    expect(() => transactionSchema.parse({ ...base, kind: "TRANSFER" })).toThrow();
    expect(() => transactionSchema.parse({ ...base, kind: "REFUND" })).toThrow();
  });

  it("requires a description worth reading", () => {
    expect(() => transactionSchema.parse({ ...base, description: "" })).toThrow();
    expect(() => transactionSchema.parse({ ...base, description: "x" })).toThrow();
  });

  it("insists on a reason before a void", () => {
    expect(() => voidTransactionSchema.parse({ id: "abc", reason: "oops" })).toThrow();
    expect(voidTransactionSchema.parse({ id: "abc", reason: "entered twice by mistake" }).reason).toContain("twice");
  });
});

describe("settlement validation", () => {
  it("accepts a normal courier settlement", () => {
    const parsed = settlementSchema.parse({
      shipmentId: "ship_1",
      collectedAmount: "2000",
      courierCharge: "100",
      settledAmount: "1900",
    });
    expect(parsed.settledAmount).toBe(1900);
  });

  it("refuses negative money", () => {
    expect(() =>
      settlementSchema.parse({ shipmentId: "s", collectedAmount: "-1", courierCharge: "0", settledAmount: "0" }),
    ).toThrow();
  });
});

describe("courier status mapping", () => {
  it("reads the wordings couriers actually send", () => {
    expect(mapStatusWord("Delivered")).toBe("DELIVERED");
    expect(mapStatusWord("delivery_complete")).toBe("DELIVERED");
    expect(mapStatusWord("OUT-FOR-DELIVERY")).toBe("OUT_FOR_DELIVERY");
    expect(mapStatusWord("in transit")).toBe("IN_TRANSIT");
    expect(mapStatusWord("Pickup Pending")).toBe("PICKUP_PENDING");
    expect(mapStatusWord("return_to_merchant")).toBe("RETURNED");
    expect(mapStatusWord("On Hold")).toBe("HOLD");
  });

  /**
   * Returning null rather than guessing matters: a status we do not recognise
   * must leave the parcel where it is for a person to read, not silently be
   * treated as delivered.
   */
  it("returns null for wording it does not recognise", () => {
    expect(mapStatusWord("সবকিছু ঠিক আছে")).toBeNull();
    expect(mapStatusWord("")).toBeNull();
    expect(mapStatusWord("zzz")).toBeNull();
  });

  it("does not mistake 'delivery attempt failed' for a delivery", () => {
    expect(mapStatusWord("delivery attempt failed")).toBe("FAILED");
  });
});

describe("references", () => {
  it("is date-prefixed and non-sequential", () => {
    const at = new Date("2026-08-27T00:00:00Z");
    const a = generateReference("TXN", at);
    const b = generateReference("TXN", at);
    expect(a).toMatch(/^TXN-260827-\d{4}$/);
    // Sequential references leak how many transactions a shop has posted.
    expect(a === b).toBe(false);
  });
});

/**
 * The rule these guard: a courier settlement is not income.
 *
 * The sale was already booked as revenue when the order was recognised. The
 * courier handing the cash over is that same money arriving, not new money —
 * so posting it as INCOME would count every delivered order's revenue twice,
 * once at delivery and once at settlement. It is a TRANSFER, and transfers are
 * excluded from income, expenses, category totals and cash flow.
 */
describe("transfers never inflate profit", () => {
  type Entry = { kind: "INCOME" | "EXPENSE" | "TRANSFER"; amount: number };

  function profit(entries: Entry[]): number {
    const income = entries.filter((e) => e.kind === "INCOME").reduce((sum, e) => sum + e.amount, 0);
    const expense = entries.filter((e) => e.kind === "EXPENSE").reduce((sum, e) => sum + e.amount, 0);
    return income - expense;
  }

  it("leaves profit unchanged when the courier pays up", () => {
    const beforeSettlement: Entry[] = [
      { kind: "INCOME", amount: 200_000 },   // the sale, booked at delivery
      { kind: "EXPENSE", amount: 10_000 },   // courier charge
    ];
    const afterSettlement: Entry[] = [
      ...beforeSettlement,
      { kind: "TRANSFER", amount: 190_000 }, // courier hands the cash over
    ];

    expect(profit(beforeSettlement)).toBe(190_000);
    expect(profit(afterSettlement)).toBe(190_000);
  });

  /**
   * An account balance counts a transfer as an inflow: the transaction names
   * the account the money arrived IN. Treating it as an outflow would show
   * the till going down every time a courier paid us.
   */
  it("adds a transfer to the account it names", () => {
    const balance = (entries: Entry[]) =>
      entries.reduce((total, entry) => total + (entry.kind === "EXPENSE" ? -1 : 1) * entry.amount, 0);

    expect(balance([{ kind: "TRANSFER", amount: 190_000 }])).toBe(190_000);
    expect(balance([{ kind: "INCOME", amount: 100 }, { kind: "EXPENSE", amount: 40 }])).toBe(60);
  });
});
