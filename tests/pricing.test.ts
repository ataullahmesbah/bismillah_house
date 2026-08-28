import { describe, expect, it } from "vitest";

import {
  allocateCouponDiscount, calculateShipping, evaluateCoupon, isLineCouponEligible,
  priceLines, quoteCart, resolveUnitPrice,
  type CartLineInput, type CouponPricing, type DistrictPricing, type FlashSaleItemPricing,
  type OfferPricing, type ProductPricing, type ShippingConfig, type VariantPricing,
} from "@/lib/services/pricing";
import { toMinor } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const NOW = new Date("2026-06-15T12:00:00Z");
const EARLIER = new Date("2026-06-15T10:00:00Z");
const LATER = new Date("2026-06-15T14:00:00Z");
const LAST_WEEK = new Date("2026-06-08T12:00:00Z");

function product(overrides: Partial<ProductPricing> = {}): ProductPricing {
  return {
    id: "p1",
    name: "Premium Dates",
    slug: "premium-dates",
    categoryId: "c1",
    price: toMinor(500),
    compareAtPrice: toMinor(650),
    stock: 50,
    hasVariants: false,
    shippingMode: "STANDARD",
    shippingFlatFee: null,
    ...overrides,
  };
}

function variant(overrides: Partial<VariantPricing> = {}): VariantPricing {
  return {
    id: "v1",
    name: "1kg",
    sku: "DATES-1KG",
    price: toMinor(900),
    compareAtPrice: null,
    stock: 20,
    isActive: true,
    ...overrides,
  };
}

function line(overrides: Partial<CartLineInput> = {}): CartLineInput {
  return { key: "l1", quantity: 1, product: product(), variant: null, ...overrides };
}

function offer(overrides: Partial<OfferPricing> = {}): OfferPricing {
  return {
    id: "o1",
    title: "2-hour offer",
    discountType: "PERCENT",
    discountValue: 10,
    maxDiscountAmount: null,
    scope: "GLOBAL",
    startAt: EARLIER,
    endAt: LATER,
    priority: 0,
    badgeText: "Offer",
    showCountdown: true,
    productIds: [],
    categoryIds: [],
    ...overrides,
  };
}

function flashItem(overrides: Partial<FlashSaleItemPricing> = {}): FlashSaleItemPricing {
  return {
    id: "f1",
    flashSaleId: "fs1",
    productId: "p1",
    variantId: null,
    salePrice: toMinor(400),
    stockLimit: null,
    soldCount: 0,
    startAt: EARLIER,
    endAt: LATER,
    title: "Flash sale",
    ...overrides,
  };
}

function coupon(overrides: Partial<CouponPricing> = {}): CouponPricing {
  return {
    id: "cp1",
    code: "TRUST10",
    title: "10% off",
    discountType: "PERCENT",
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    startAt: EARLIER,
    endAt: LATER,
    usageLimit: null,
    usageCount: 0,
    perCustomerLimit: null,
    isActive: true,
    scope: "GLOBAL",
    allowOnFlashSale: false,
    allowStacking: false,
    productIds: [],
    categoryIds: [],
    excludedProductIds: [],
    ...overrides,
  };
}

const district: DistrictPricing = {
  id: "d1",
  name: "Dhaka",
  deliveryCharge: toMinor(60),
  isFreeDelivery: false,
  isActive: true,
  estimatedDays: "1-2",
};

const shippingConfig: ShippingConfig = {
  defaultCharge: toMinor(120),
  freeDeliveryOverAmount: null,
  mixedCartStrategy: "highest",
};

/* -------------------------------------------------------------------------- */
/* Unit price resolution                                                       */
/* -------------------------------------------------------------------------- */

describe("resolveUnitPrice", () => {
  it("uses the base price when there is no variant or campaign", () => {
    const price = resolveUnitPrice(product(), null, [], [], NOW);
    expect(price.unitPrice).toBe(toMinor(500));
    expect(price.source).toBe("BASE");
  });

  it("uses the variant price over the base price", () => {
    const price = resolveUnitPrice(product(), variant(), [], [], NOW);
    expect(price.unitPrice).toBe(toMinor(900));
    expect(price.source).toBe("VARIANT");
  });

  it("supports different prices per variant — 500g/1kg/2kg", () => {
    const base = product({ price: toMinor(500) });
    const prices = [
      resolveUnitPrice(base, variant({ id: "a", name: "500g", price: toMinor(500) }), [], [], NOW),
      resolveUnitPrice(base, variant({ id: "b", name: "1kg", price: toMinor(900) }), [], [], NOW),
      resolveUnitPrice(base, variant({ id: "c", name: "2kg", price: toMinor(1700) }), [], [], NOW),
    ].map((price) => price.unitPrice);

    expect(prices).toEqual([toMinor(500), toMinor(900), toMinor(1700)]);
  });

  it("applies an active flash sale price", () => {
    const price = resolveUnitPrice(product(), null, [flashItem()], [], NOW);
    expect(price.unitPrice).toBe(toMinor(400));
    expect(price.source).toBe("FLASH_SALE");
    expect(price.flashSaleEndsAt).toEqual(LATER);
  });

  it("ignores a flash sale that has not started or has ended", () => {
    const expired = flashItem({ startAt: LAST_WEEK, endAt: EARLIER });
    expect(resolveUnitPrice(product(), null, [expired], [], NOW).source).toBe("BASE");
  });

  it("ignores a flash sale whose campaign stock is exhausted", () => {
    const soldOut = flashItem({ stockLimit: 10, soldCount: 10 });
    expect(resolveUnitPrice(product(), null, [soldOut], [], NOW).source).toBe("BASE");
  });

  it("prefers a variant-specific flash row over a product-wide one", () => {
    const productWide = flashItem({ id: "wide", variantId: null, salePrice: toMinor(850) });
    const variantRow = flashItem({ id: "narrow", variantId: "v1", salePrice: toMinor(800) });
    const price = resolveUnitPrice(product(), variant(), [productWide, variantRow], [], NOW);
    expect(price.flashSaleItemId).toBe("narrow");
    expect(price.unitPrice).toBe(toMinor(800));
  });

  it("applies a percentage offer", () => {
    const price = resolveUnitPrice(product(), null, [], [offer()], NOW);
    expect(price.unitPrice).toBe(toMinor(450));
    expect(price.source).toBe("OFFER");
  });

  it("caps an offer at its maximum discount", () => {
    const capped = offer({ discountType: "PERCENT", discountValue: 50, maxDiscountAmount: toMinor(100) });
    const price = resolveUnitPrice(product(), null, [], [capped], NOW);
    expect(price.unitPrice).toBe(toMinor(400));
  });

  it("only applies a product-scoped offer to its own products", () => {
    const scoped = offer({ scope: "PRODUCT", productIds: ["other"] });
    expect(resolveUnitPrice(product(), null, [], [scoped], NOW).source).toBe("BASE");

    const matching = offer({ scope: "PRODUCT", productIds: ["p1"] });
    expect(resolveUnitPrice(product(), null, [], [matching], NOW).source).toBe("OFFER");
  });

  it("only applies a category-scoped offer inside that category", () => {
    const scoped = offer({ scope: "CATEGORY", categoryIds: ["c9"] });
    expect(resolveUnitPrice(product(), null, [], [scoped], NOW).source).toBe("BASE");

    const matching = offer({ scope: "CATEGORY", categoryIds: ["c1"] });
    expect(resolveUnitPrice(product(), null, [], [matching], NOW).source).toBe("OFFER");
  });

  it("expires an offer automatically once its window closes", () => {
    const ended = offer({ startAt: LAST_WEEK, endAt: EARLIER });
    expect(resolveUnitPrice(product(), null, [], [ended], NOW).source).toBe("BASE");
  });

  it("gives the customer the lower of a flash sale and an offer", () => {
    const cheapFlash = flashItem({ salePrice: toMinor(300) });
    const smallOffer = offer({ discountValue: 5 });
    expect(resolveUnitPrice(product(), null, [cheapFlash], [smallOffer], NOW).unitPrice).toBe(toMinor(300));

    const weakFlash = flashItem({ salePrice: toMinor(490) });
    const bigOffer = offer({ discountValue: 40 });
    expect(resolveUnitPrice(product(), null, [weakFlash], [bigOffer], NOW).unitPrice).toBe(toMinor(300));
  });
});

/* -------------------------------------------------------------------------- */
/* Line pricing and availability                                               */
/* -------------------------------------------------------------------------- */

describe("priceLines", () => {
  it("marks an out-of-stock line unavailable", () => {
    const [priced] = priceLines([line({ product: product({ stock: 0 }) })], [], [], NOW);
    expect(priced!.isAvailable).toBe(false);
    expect(priced!.unavailableReason).toBe("Out of stock.");
  });

  it("flags a line that exceeds the remaining stock", () => {
    const [priced] = priceLines([line({ quantity: 5, product: product({ stock: 3 }) })], [], [], NOW);
    expect(priced!.isAvailable).toBe(false);
    expect(priced!.unavailableReason).toContain("Only 3 left");
  });

  it("rejects a deactivated variant", () => {
    const [priced] = priceLines([line({ variant: variant({ isActive: false }) })], [], [], NOW);
    expect(priced!.isAvailable).toBe(false);
  });

  it("records the flash and offer savings separately", () => {
    const [flashLine] = priceLines([line({ quantity: 2 })], [flashItem()], [], NOW);
    expect(flashLine!.flashDiscount).toBe(toMinor(200));
    expect(flashLine!.offerDiscount).toBe(0);

    const [offerLine] = priceLines([line({ quantity: 2 })], [], [offer()], NOW);
    expect(offerLine!.offerDiscount).toBe(toMinor(100));
    expect(offerLine!.flashDiscount).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */

describe("evaluateCoupon", () => {
  const context = { now: NOW, customerUsageCount: 0 };

  it("applies a global percentage coupon", () => {
    const lines = priceLines([line({ quantity: 2 })], [], [], NOW);
    const result = evaluateCoupon(coupon(), lines, context);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(toMinor(100));
  });

  it("applies a fixed-amount coupon", () => {
    const lines = priceLines([line()], [], [], NOW);
    const result = evaluateCoupon(coupon({ discountType: "FIXED", discountValue: toMinor(100) }), lines, context);
    expect(result.discount).toBe(toMinor(100));
  });

  it("caps a percentage coupon at its maximum discount", () => {
    const lines = priceLines([line({ quantity: 10 })], [], [], NOW);
    const result = evaluateCoupon(coupon({ discountValue: 20, maxDiscountAmount: toMinor(300) }), lines, context);
    expect(result.discount).toBe(toMinor(300));
  });

  it("never discounts more than the eligible subtotal", () => {
    const lines = priceLines([line()], [], [], NOW);
    const result = evaluateCoupon(coupon({ discountType: "FIXED", discountValue: toMinor(9999) }), lines, context);
    expect(result.discount).toBe(toMinor(500));
  });

  it("refuses an inactive, unstarted or expired coupon", () => {
    const lines = priceLines([line()], [], [], NOW);
    expect(evaluateCoupon(coupon({ isActive: false }), lines, context).reason).toMatch(/no longer active/i);
    expect(evaluateCoupon(coupon({ startAt: LATER, endAt: LATER }), lines, context).reason).toMatch(/not active yet/i);
    expect(evaluateCoupon(coupon({ startAt: LAST_WEEK, endAt: EARLIER }), lines, context).reason).toMatch(/expired/i);
  });

  it("refuses a coupon that has hit its total usage limit", () => {
    const lines = priceLines([line()], [], [], NOW);
    const result = evaluateCoupon(coupon({ usageLimit: 5, usageCount: 5 }), lines, context);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/usage limit/i);
  });

  it("refuses a coupon that this customer has already used up", () => {
    const lines = priceLines([line()], [], [], NOW);
    const result = evaluateCoupon(coupon({ perCustomerLimit: 1 }), lines, { now: NOW, customerUsageCount: 1 });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already used/i);
  });

  it("enforces the minimum cart amount", () => {
    const lines = priceLines([line()], [], [], NOW);
    const result = evaluateCoupon(coupon({ minOrderAmount: toMinor(1000) }), lines, context);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/minimum order/i);
  });

  it("only discounts the products a product-scoped coupon targets", () => {
    const lines = priceLines(
      [
        line({ key: "a", product: product({ id: "p1" }) }),
        line({ key: "b", product: product({ id: "p2", price: toMinor(1000) }) }),
      ],
      [], [], NOW,
    );
    const result = evaluateCoupon(
      coupon({ scope: "PRODUCT", productIds: ["p1"], discountType: "FIXED", discountValue: toMinor(100) }),
      lines, context,
    );
    expect(result.valid).toBe(true);
    expect(result.eligibleLineKeys).toEqual(["a"]);
    expect(result.eligibleSubtotal).toBe(toMinor(500));
  });

  it("respects category scope", () => {
    const lines = priceLines(
      [
        line({ key: "a", product: product({ id: "p1", categoryId: "c1" }) }),
        line({ key: "b", product: product({ id: "p2", categoryId: "c2" }) }),
      ],
      [], [], NOW,
    );
    const result = evaluateCoupon(coupon({ scope: "CATEGORY", categoryIds: ["c2"] }), lines, context);
    expect(result.eligibleLineKeys).toEqual(["b"]);
  });

  it("honours product exclusions", () => {
    const lines = priceLines([line({ key: "a", product: product({ id: "p1" }) })], [], [], NOW);
    const result = evaluateCoupon(coupon({ excludedProductIds: ["p1"] }), lines, context);
    expect(result.valid).toBe(false);
  });

  it("skips flash-sale lines unless the coupon allows them", () => {
    const lines = priceLines([line()], [flashItem()], [], NOW);
    expect(evaluateCoupon(coupon({ allowOnFlashSale: false }), lines, context).valid).toBe(false);
    expect(evaluateCoupon(coupon({ allowOnFlashSale: true }), lines, context).valid).toBe(true);
  });

  it("does not stack with an offer unless stacking is explicitly enabled", () => {
    const lines = priceLines([line()], [], [offer()], NOW);
    expect(evaluateCoupon(coupon({ allowStacking: false }), lines, context).valid).toBe(false);
    expect(evaluateCoupon(coupon({ allowStacking: true }), lines, context).valid).toBe(true);
  });

  it("ignores unavailable lines when deciding eligibility", () => {
    const lines = priceLines([line({ product: product({ stock: 0 }) })], [], [], NOW);
    const available = lines.filter((row) => row.isAvailable);
    expect(evaluateCoupon(coupon(), available, context).valid).toBe(false);
  });
});

describe("allocateCouponDiscount", () => {
  it("splits the discount proportionally and never loses a poisha", () => {
    const lines = priceLines(
      [
        line({ key: "a", product: product({ id: "p1", price: toMinor(300) }) }),
        line({ key: "b", product: product({ id: "p2", price: toMinor(700) }) }),
      ],
      [], [], NOW,
    );
    const evaluation = evaluateCoupon(coupon({ discountType: "FIXED", discountValue: toMinor(101) }), lines, {
      now: NOW, customerUsageCount: 0,
    });
    const allocated = allocateCouponDiscount(lines, evaluation);
    const total = allocated.reduce((sum, row) => sum + row.couponDiscount, 0);

    expect(total).toBe(toMinor(101));
    expect(allocated.every((row) => row.couponDiscount >= 0)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Delivery                                                                    */
/* -------------------------------------------------------------------------- */

describe("calculateShipping", () => {
  const standardLine = () => priceLines([line()], [], [], NOW);

  it("charges the district rate for a standard product", () => {
    const quote = calculateShipping(standardLine(), district, shippingConfig, toMinor(500));
    expect(quote.total).toBe(toMinor(60));
  });

  it("charges nothing in a free-delivery district", () => {
    const free = { ...district, name: "Sylhet", isFreeDelivery: true };
    const quote = calculateShipping(standardLine(), free, shippingConfig, toMinor(500));
    expect(quote.total).toBe(0);
    expect(quote.freeReason).toContain("Sylhet");
  });

  it("charges nothing for a product marked free delivery", () => {
    const lines = priceLines([line({ product: product({ shippingMode: "FREE" }) })], [], [], NOW);
    const quote = calculateShipping(lines, district, shippingConfig, toMinor(500));
    expect(quote.total).toBe(0);
  });

  it("uses a product's fixed charge instead of the district rate", () => {
    const lines = priceLines(
      [line({ product: product({ shippingMode: "FIXED", shippingFlatFee: toMinor(100) }) })],
      [], [], NOW,
    );
    const quote = calculateShipping(lines, district, shippingConfig, toMinor(500));
    expect(quote.total).toBe(toMinor(100));
  });

  it("charges a product's fixed fee once regardless of quantity", () => {
    const lines = priceLines(
      [line({ quantity: 4, product: product({ shippingMode: "FIXED", shippingFlatFee: toMinor(100) }) })],
      [], [], NOW,
    );
    expect(calculateShipping(lines, district, shippingConfig, toMinor(2000)).total).toBe(toMinor(100));
  });

  it("takes the single highest charge in a mixed cart by default", () => {
    const lines = priceLines(
      [
        line({ key: "a", product: product({ id: "p1" }) }),
        line({ key: "b", product: product({ id: "p2", shippingMode: "FIXED", shippingFlatFee: toMinor(100) }) }),
        line({ key: "c", product: product({ id: "p3", shippingMode: "FREE" }) }),
      ],
      [], [], NOW,
    );
    expect(calculateShipping(lines, district, shippingConfig, toMinor(1500)).total).toBe(toMinor(100));
  });

  it("adds every charge together under the sum strategy", () => {
    const lines = priceLines(
      [
        line({ key: "a", product: product({ id: "p1" }) }),
        line({ key: "b", product: product({ id: "p2", shippingMode: "FIXED", shippingFlatFee: toMinor(100) }) }),
      ],
      [], [], NOW,
    );
    const quote = calculateShipping(lines, district, { ...shippingConfig, mixedCartStrategy: "sum" }, toMinor(1500));
    expect(quote.total).toBe(toMinor(160));
  });

  it("ignores product surcharges under the district-only strategy", () => {
    const lines = priceLines(
      [line({ product: product({ shippingMode: "FIXED", shippingFlatFee: toMinor(100) }) })],
      [], [], NOW,
    );
    const quote = calculateShipping(lines, district, { ...shippingConfig, mixedCartStrategy: "district_only" }, toMinor(500));
    expect(quote.total).toBe(toMinor(60));
  });

  it("waives delivery once the free-delivery threshold is reached", () => {
    const config = { ...shippingConfig, freeDeliveryOverAmount: toMinor(1000) };
    expect(calculateShipping(standardLine(), district, config, toMinor(999)).total).toBe(toMinor(60));
    expect(calculateShipping(standardLine(), district, config, toMinor(1000)).total).toBe(0);
  });

  it("keeps a free-delivery district free even when a product carries a surcharge", () => {
    // Sylhet is free as a promise to the customer; a per-product fixed fee
    // must not quietly reintroduce a charge there.
    const free = { ...district, name: "Sylhet", isFreeDelivery: true };
    const lines = priceLines(
      [line({ product: product({ shippingMode: "FIXED", shippingFlatFee: toMinor(150) }) })],
      [], [], NOW,
    );

    const quote = calculateShipping(lines, free, shippingConfig, toMinor(900));
    expect(quote.total).toBe(0);
    expect(quote.freeReason).toMatch(/Sylhet/);
  });

  it("does not charge delivery on a cart whose only lines are unavailable", () => {
    // Out-of-stock lines are excluded from the totals, so charging to deliver
    // them would be charging for nothing.
    const lines = priceLines([line({ product: product({ stock: 0 }) })], [], [], NOW);
    const quote = calculateShipping(lines, district, shippingConfig, 0);
    expect(quote.total).toBe(0);
  });

  it("quotes the configured fallback before a district is chosen", () => {
    const quote = calculateShipping(standardLine(), null, shippingConfig, toMinor(500));
    expect(quote.total).toBe(toMinor(120));
    expect(quote.breakdown[0]?.note).toMatch(/select your district/i);
  });

  it("charges nothing for an empty cart", () => {
    expect(calculateShipping([], district, shippingConfig, 0).total).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* End-to-end quote                                                            */
/* -------------------------------------------------------------------------- */

describe("quoteCart", () => {
  it("produces totals that add up exactly", () => {
    const quote = quoteCart({
      lines: [
        line({ key: "a", quantity: 2, variant: variant({ price: toMinor(900) }) }),
        line({ key: "b", product: product({ id: "p2", categoryId: "c1", price: toMinor(320) }) }),
      ],
      flashSaleItems: [],
      offers: [],
      coupon: coupon({ discountType: "FIXED", discountValue: toMinor(100) }),
      couponContext: { now: NOW, customerUsageCount: 0 },
      district,
      shippingConfig,
      now: NOW,
    });

    const expectedSubtotal = toMinor(900) * 2 + toMinor(320);
    expect(quote.subtotal).toBe(expectedSubtotal);
    expect(quote.couponDiscount).toBe(toMinor(100));
    expect(quote.shipping.total).toBe(toMinor(60));
    expect(quote.grandTotal).toBe(expectedSubtotal - toMinor(100) + toMinor(60));
  });

  it("reports why a coupon was refused instead of silently dropping it", () => {
    const quote = quoteCart({
      lines: [line()],
      flashSaleItems: [],
      offers: [],
      coupon: coupon({ minOrderAmount: toMinor(5000) }),
      couponContext: { now: NOW, customerUsageCount: 0 },
      district,
      shippingConfig,
      now: NOW,
    });

    expect(quote.coupon).toBeNull();
    expect(quote.couponError).toMatch(/minimum order/i);
    expect(quote.couponDiscount).toBe(0);
  });

  it("rejects a code that matches no coupon instead of reporting it as applied", () => {
    // A typo loads as no coupon at all. Without the requested code the quote
    // cannot tell that apart from "no coupon was offered", and the cart used
    // to render the shopper's typo back at them as successfully applied.
    const quote = quoteCart({
      lines: [line()],
      flashSaleItems: [],
      offers: [],
      coupon: null,
      requestedCouponCode: "NOTACOUPON",
      couponContext: { now: NOW, customerUsageCount: 0 },
      district,
      shippingConfig,
      now: NOW,
    });

    expect(quote.coupon).toBeNull();
    expect(quote.couponError).toMatch(/NOTACOUPON/);
    expect(quote.couponError).toMatch(/not valid/i);
    expect(quote.couponDiscount).toBe(0);
  });

  it("stays quiet when no coupon was offered at all", () => {
    const quote = quoteCart({
      lines: [line()],
      flashSaleItems: [],
      offers: [],
      coupon: null,
      couponContext: { now: NOW, customerUsageCount: 0 },
      district,
      shippingConfig,
      now: NOW,
    });

    expect(quote.couponError).toBeNull();
    expect(quote.couponDiscount).toBe(0);
  });

  it("excludes unavailable lines from every total", () => {
    const quote = quoteCart({
      lines: [
        line({ key: "a" }),
        line({ key: "b", product: product({ id: "p2", stock: 0 }) }),
      ],
      flashSaleItems: [],
      offers: [],
      coupon: null,
      couponContext: { now: NOW, customerUsageCount: 0 },
      district,
      shippingConfig,
      now: NOW,
    });

    expect(quote.unavailableLines).toHaveLength(1);
    expect(quote.itemCount).toBe(1);
    expect(quote.subtotal).toBe(toMinor(500));
  });

  it("combines a flash sale, an offer and a coupon without double counting", () => {
    const quote = quoteCart({
      lines: [
        line({ key: "a", product: product({ id: "p1" }) }),
        line({ key: "b", product: product({ id: "p2", price: toMinor(1000) }) }),
      ],
      flashSaleItems: [flashItem({ productId: "p1", salePrice: toMinor(400) })],
      offers: [offer({ scope: "PRODUCT", productIds: ["p2"], discountValue: 10 })],
      coupon: coupon({ allowOnFlashSale: true, allowStacking: true, discountType: "FIXED", discountValue: toMinor(50) }),
      couponContext: { now: NOW, customerUsageCount: 0 },
      district,
      shippingConfig,
      now: NOW,
    });

    expect(quote.subtotal).toBe(toMinor(1500));
    expect(quote.flashDiscount).toBe(toMinor(100));
    expect(quote.offerDiscount).toBe(toMinor(100));
    expect(quote.couponDiscount).toBe(toMinor(50));
    expect(quote.totalDiscount).toBe(toMinor(250));
    expect(quote.grandTotal).toBe(toMinor(1500) - toMinor(250) + toMinor(60));
  });
});

describe("isLineCouponEligible", () => {
  it("treats a global coupon as covering everything not excluded", () => {
    const [priced] = priceLines([line()], [], [], NOW);
    expect(isLineCouponEligible(coupon(), priced!)).toBe(true);
    expect(isLineCouponEligible(coupon({ excludedProductIds: ["p1"] }), priced!)).toBe(false);
  });
});
