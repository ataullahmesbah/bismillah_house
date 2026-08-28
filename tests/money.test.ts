import { describe, expect, it } from "vitest";

import {
  clampDiscount, discountPercent, formatMoney, fromMinor, percentOf, sumMinor, toMinor,
} from "@/lib/money";

describe("money", () => {
  it("converts taka to minor units without floating point drift", () => {
    expect(toMinor(500)).toBe(50000);
    expect(toMinor(0.1)).toBe(10);
    expect(toMinor("1,700")).toBe(170000);
    expect(toMinor(19.99)).toBe(1999);
  });

  it("round-trips through minor units", () => {
    expect(fromMinor(toMinor(1234.56))).toBe(1234.56);
  });

  it("formats whole amounts without decimals", () => {
    expect(formatMoney(50000)).toBe("৳500");
    expect(formatMoney(1999)).toBe("৳19.99");
    expect(formatMoney(50000, { withSymbol: false })).toBe("500");
  });

  it("calculates percentages on integers", () => {
    expect(percentOf(50000, 10)).toBe(5000);
    // Rounds to the nearest poisha rather than truncating.
    expect(percentOf(333, 10)).toBe(33);
  });

  it("never lets a discount exceed the amount it applies to", () => {
    expect(clampDiscount(90000, 50000)).toBe(50000);
    expect(clampDiscount(-10, 50000)).toBe(0);
  });

  it("computes a display discount percentage", () => {
    expect(discountPercent(65000, 50000)).toBe(23);
    expect(discountPercent(50000, 50000)).toBeNull();
    expect(discountPercent(null, 50000)).toBeNull();
  });

  it("sums nullable amounts", () => {
    expect(sumMinor([100, null, 250, undefined])).toBe(350);
  });
});
