import { describe, expect, it } from "vitest";

import {
  emailSchema, moneyInputSchema, optionalMoneySchema, passwordSchema, phoneSchema,
  slugSchema, urlSchema, formDataToObject, formDataList,
} from "@/lib/validation/common";
import { addToCartSchema, checkoutSchema, couponSchema, offerSchema } from "@/lib/validation/commerce";
import { productSchema } from "@/lib/validation/catalog";
import { registerSchema } from "@/lib/validation/auth";
import { slugify, cartesian, buildQuery, truncate, humanizeEnum } from "@/lib/utils";

describe("phone validation", () => {
  it("normalises Bangladeshi formats to 01XXXXXXXXX", () => {
    expect(phoneSchema.parse("+8801712345678")).toBe("01712345678");
    expect(phoneSchema.parse("8801712345678")).toBe("01712345678");
    expect(phoneSchema.parse("017-1234 5678")).toBe("01712345678");
  });

  it("rejects invalid numbers", () => {
    expect(() => phoneSchema.parse("0121234567")).toThrow();
    expect(() => phoneSchema.parse("12345")).toThrow();
    expect(() => phoneSchema.parse("01212345678")).toThrow();
  });
});

describe("email and password rules", () => {
  it("lowercases and trims emails", () => {
    expect(emailSchema.parse("  Nusrat@Example.COM ")).toBe("nusrat@example.com");
  });

  it("requires a mix of character classes in a password", () => {
    expect(() => passwordSchema.parse("short1A")).toThrow();
    expect(() => passwordSchema.parse("alllowercase1")).toThrow();
    expect(() => passwordSchema.parse("ALLUPPERCASE1")).toThrow();
    expect(() => passwordSchema.parse("NoDigitsHere")).toThrow();
    expect(passwordSchema.parse("Correct1Horse")).toBe("Correct1Horse");
  });

  it("requires matching confirmation on registration", () => {
    const base = {
      name: "Nusrat Jahan",
      email: "n@example.com",
      phone: "01712345678",
      password: "Correct1Horse",
    };
    expect(() => registerSchema.parse({ ...base, confirmPassword: "Different1Horse" })).toThrow();
    expect(registerSchema.parse({ ...base, confirmPassword: "Correct1Horse" }).email).toBe("n@example.com");
  });
});

describe("money input", () => {
  it("converts a taka string to minor units", () => {
    expect(moneyInputSchema.parse("500")).toBe(50000);
    expect(moneyInputSchema.parse("1,700.50")).toBe(170050);
    expect(moneyInputSchema.parse(0)).toBe(0);
  });

  it("treats blank optional money as null", () => {
    expect(optionalMoneySchema.parse("")).toBeNull();
    expect(optionalMoneySchema.parse(null)).toBeNull();
    expect(optionalMoneySchema.parse("120")).toBe(12000);
  });

  it("rejects negative amounts", () => {
    expect(() => moneyInputSchema.parse("-5")).toThrow();
  });
});

describe("url and slug safety", () => {
  it("accepts relative paths and http(s) URLs", () => {
    expect(urlSchema.parse("/shop")).toBe("/shop");
    expect(urlSchema.parse("https://example.com/a")).toBe("https://example.com/a");
  });

  it("rejects javascript: and protocol-relative URLs", () => {
    expect(() => urlSchema.parse("javascript:alert(1)")).toThrow();
    expect(() => urlSchema.parse("//evil.example")).toThrow();
  });

  it("accepts clean slugs and rejects malformed ones", () => {
    expect(slugSchema.parse("premium-ajwa-dates")).toBe("premium-ajwa-dates");
    expect(() => slugSchema.parse("has spaces")).toThrow();
    expect(() => slugSchema.parse("-leading")).toThrow();
  });
});

/**
 * A conditionally rendered input is simply absent from the FormData. Zod
 * rejects a *missing* key unless the schema is `.optional()`, even when the
 * schema accepts `undefined` as a value — so these cases are the ones that
 * break real forms.
 */
describe("optional fields tolerate a missing key", () => {
  it("parses a checkout with no bKash field rendered (cash on delivery)", () => {
    // Exactly what the browser posts for a COD guest order: no bkashTransactionId,
    // no saveAddress checkbox, no addressLine2.
    const form = new FormData();
    form.set("fullName", "Nusrat Jahan");
    form.set("phone", "01712345678");
    form.set("districtId", "d1");
    form.set("addressLine1", "House 12, Road 5");
    form.set("paymentMethod", "COD");

    const parsed = checkoutSchema.parse(formDataToObject(form));
    expect(parsed.bkashTransactionId).toBeNull();
    expect(parsed.saveAddress).toBe(false);
    expect(parsed.addressLine2).toBeNull();
    expect(parsed.email).toBeNull();
  });

  it("parses a product with every optional field omitted", () => {
    const form = new FormData();
    form.set("name", "Minimal product");
    form.set("price", "500");
    form.set("status", "DRAFT");

    const parsed = productSchema.parse(formDataToObject(form));
    expect(parsed.slug).toBeUndefined();
    expect(parsed.categoryId).toBeNull();
    expect(parsed.compareAtPrice).toBeNull();
    expect(parsed.shippingFlatFee).toBeNull();
    expect(parsed.isFeatured).toBe(false);
  });

  it("parses an add-to-cart post with no variant field", () => {
    const form = new FormData();
    form.set("productId", "p1");
    const parsed = addToCartSchema.parse(formDataToObject(form));
    expect(parsed.variantId).toBeNull();
    expect(parsed.quantity).toBe(1);
  });
});

describe("checkout validation", () => {
  const base = {
    fullName: "Nusrat Jahan",
    phone: "01712345678",
    email: "",
    addressId: "",
    districtId: "d1",
    city: "Dhaka",
    area: "Dhanmondi",
    addressLine1: "House 12, Road 5",
    addressLine2: "",
    postalCode: "1205",
    paymentMethod: "COD" as const,
    bkashTransactionId: "",
    couponCode: "",
    customerNote: "",
    saveAddress: "on",
  };

  it("accepts a complete cash-on-delivery order", () => {
    const parsed = checkoutSchema.parse(base);
    expect(parsed.paymentMethod).toBe("COD");
    expect(parsed.email).toBeNull();
    expect(parsed.saveAddress).toBe(true);
  });

  it("requires both bKash details when bKash is chosen", () => {
    // Neither detail on its own lets staff reconcile a payment: the ID finds
    // the transaction, the number proves who sent it.
    expect(() => checkoutSchema.parse({ ...base, paymentMethod: "BKASH" })).toThrow(/transaction ID/i);
    expect(() =>
      checkoutSchema.parse({ ...base, paymentMethod: "BKASH", bkashTransactionId: "TRX123" }),
    ).toThrow(/number you paid from/i);
    expect(() =>
      checkoutSchema.parse({ ...base, paymentMethod: "BKASH", bkashSenderNumber: "01712345678" }),
    ).toThrow(/transaction ID/i);

    const parsed = checkoutSchema.parse({
      ...base,
      paymentMethod: "BKASH",
      bkashTransactionId: "TRX123",
      bkashSenderNumber: "01712345678",
    });
    expect(parsed.bkashTransactionId).toBe("TRX123");
    expect(parsed.bkashSenderNumber).toBe("01712345678");
  });

  it("normalises a +880 bKash number to local form", () => {
    const parsed = checkoutSchema.parse({
      ...base,
      paymentMethod: "BKASH",
      bkashTransactionId: "TRX123",
      bkashSenderNumber: "+8801712345678",
    });
    expect(parsed.bkashSenderNumber).toBe("01712345678");
  });

  it("leaves the bKash fields optional for cash on delivery", () => {
    const parsed = checkoutSchema.parse({ ...base, paymentMethod: "COD" });
    expect(parsed.bkashSenderNumber).toBeNull();
  });

  it("requires a district and an address line", () => {
    expect(() => checkoutSchema.parse({ ...base, districtId: "" })).toThrow();
    expect(() => checkoutSchema.parse({ ...base, addressLine1: "" })).toThrow();
  });
});

describe("coupon validation", () => {
  const base = {
    code: "eid100",
    title: "Eid offer",
    description: "",
    discountType: "FIXED" as const,
    discountValue: 100,
    minOrderAmount: "500",
    maxDiscountAmount: "",
    startAt: "2026-06-01T10:00",
    endAt: "2026-06-30T23:59",
    usageLimit: 100,
    perCustomerLimit: 1,
    isActive: "on",
    scope: "GLOBAL" as const,
    allowOnFlashSale: "",
    allowStacking: "",
    productIds: [],
    categoryIds: [],
    excludedProductIds: [],
  };

  it("uppercases the code", () => {
    expect(couponSchema.parse(base).code).toBe("EID100");
  });

  it("rejects an end time before the start time", () => {
    expect(() => couponSchema.parse({ ...base, endAt: "2026-05-01T10:00" })).toThrow();
  });

  it("rejects a percentage over 100", () => {
    expect(() => couponSchema.parse({ ...base, discountType: "PERCENT", discountValue: 120 })).toThrow();
  });

  it("requires targets for a product- or category-scoped coupon", () => {
    expect(() => couponSchema.parse({ ...base, scope: "PRODUCT" })).toThrow();
    expect(() => couponSchema.parse({ ...base, scope: "CATEGORY" })).toThrow();
    expect(couponSchema.parse({ ...base, scope: "PRODUCT", productIds: ["p1"] }).productIds).toEqual(["p1"]);
  });

  it("accepts a two-hour window", () => {
    const parsed = couponSchema.parse({ ...base, startAt: "2026-06-01T10:00", endAt: "2026-06-01T12:00" });
    expect(parsed.endAt.getTime() - parsed.startAt.getTime()).toBe(2 * 60 * 60 * 1000);
  });
});

describe("offer validation", () => {
  it("requires products for a product-scoped offer", () => {
    const base = {
      title: "Flash",
      description: "",
      discountType: "PERCENT" as const,
      discountValue: 15,
      maxDiscountAmount: "",
      scope: "PRODUCT" as const,
      startAt: "2026-06-01T10:00",
      endAt: "2026-06-01T12:00",
      isActive: "on",
      priority: 0,
      badgeText: "Offer",
      showCountdown: "on",
      productIds: [],
      categoryIds: [],
    };
    expect(() => offerSchema.parse(base)).toThrow();
    expect(offerSchema.parse({ ...base, productIds: ["p1"] }).productIds).toEqual(["p1"]);
  });
});

describe("product validation", () => {
  const base = {
    name: "Premium Dates",
    slug: "",
    sku: "",
    categoryId: "",
    brandId: "",
    shortDescription: "",
    description: "",
    specifications: "",
    price: "500",
    compareAtPrice: "",
    costPrice: "",
    stock: 10,
    lowStockThreshold: 5,
    weightGrams: "",
    tags: "",
    status: "PUBLISHED" as const,
    isFeatured: "",
    isTopSelling: "",
    manualRank: 0,
    shippingMode: "STANDARD" as const,
    shippingFlatFee: "",
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    ogImageUrl: "",
    noIndex: "",
  };

  it("accepts a standard product", () => {
    const parsed = productSchema.parse(base);
    expect(parsed.price).toBe(50000);
    expect(parsed.shippingMode).toBe("STANDARD");
  });

  it("requires a fee when the shipping mode is FIXED", () => {
    expect(() => productSchema.parse({ ...base, shippingMode: "FIXED" })).toThrow();
    expect(productSchema.parse({ ...base, shippingMode: "FIXED", shippingFlatFee: "100" }).shippingFlatFee).toBe(10000);
  });

  it("rejects a compare-at price below the selling price", () => {
    expect(() => productSchema.parse({ ...base, compareAtPrice: "400" })).toThrow();
    expect(productSchema.parse({ ...base, compareAtPrice: "650" }).compareAtPrice).toBe(65000);
  });
});

describe("form data helpers", () => {
  it("collects repeated fields into arrays", () => {
    const form = new FormData();
    form.append("productIds", "a");
    form.append("productIds", "b");
    form.append("name", "Test");
    expect(formDataList(form, "productIds")).toEqual(["a", "b"]);
    expect(formDataToObject(form).name).toBe("Test");
  });
});

describe("utility helpers", () => {
  it("slugifies Latin and keeps Bengali characters", () => {
    expect(slugify("Premium Ajwa Dates!")).toBe("premium-ajwa-dates");
    expect(slugify("খেজুর প্রিমিয়াম")).toBe("খেজুর-প্রিমিয়াম");
  });

  it("builds a cartesian product for variant generation", () => {
    expect(cartesian([["s", "m"], ["black", "white"]])).toEqual([
      ["s", "black"], ["s", "white"], ["m", "black"], ["m", "white"],
    ]);
    expect(cartesian([["43", "44", "45"], ["black", "brown"]])).toHaveLength(6);
  });

  it("drops empty values from query strings", () => {
    expect(buildQuery({ q: "dates", page: undefined, sort: "" })).toBe("?q=dates");
    expect(buildQuery({})).toBe("");
  });

  it("truncates and humanises", () => {
    expect(truncate("abcdefghij", 5)).toHaveLength(5);
    expect(humanizeEnum("OUT_FOR_DELIVERY")).toBe("Out For Delivery");
  });
});
