/**
 * TRUST MART PRICING ENGINE
 * ============================================================================
 * Pure, dependency-free functions that decide what a customer actually pays.
 *
 * Nothing here reads the database or a request — the caller loads the data and
 * passes it in. That keeps the rules unit-testable and, more importantly, makes
 * it impossible for a browser-supplied price, discount or delivery fee to reach
 * the calculation: `src/lib/services/cart.ts` and the checkout action always
 * re-run these functions against freshly loaded database rows.
 *
 * Order of operations (PRD update §8):
 *   1. resolve variant / base price
 *   2. apply flash sale price
 *   3. apply the best promotional offer
 *   4. resolve coupon eligibility and discount
 *   5. calculate delivery from district rules + product overrides
 *   6. total
 */

import { clampDiscount, percentOf } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* Input shapes                                                                */
/* -------------------------------------------------------------------------- */

export type ShippingMode = "STANDARD" | "FREE" | "FIXED";
export type DiscountType = "FIXED" | "PERCENT";
export type PromotionScope = "GLOBAL" | "PRODUCT" | "CATEGORY";

export type ProductPricing = {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  /** Base price in minor units. */
  price: number;
  compareAtPrice: number | null;
  stock: number;
  hasVariants: boolean;
  shippingMode: ShippingMode;
  shippingFlatFee: number | null;
  imageUrl?: string | null;
};

export type VariantPricing = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  isActive: boolean;
  imageUrl?: string | null;
  attributes?: Array<{ attribute: string; value: string }>;
};

export type FlashSaleItemPricing = {
  id: string;
  flashSaleId: string;
  productId: string;
  variantId: string | null;
  salePrice: number;
  stockLimit: number | null;
  soldCount: number;
  startAt: Date;
  endAt: Date;
  title: string;
};

export type OfferPricing = {
  id: string;
  title: string;
  discountType: DiscountType;
  /** Minor units for FIXED, whole percent (0–100) for PERCENT. */
  discountValue: number;
  maxDiscountAmount: number | null;
  scope: PromotionScope;
  startAt: Date;
  endAt: Date;
  priority: number;
  badgeText: string | null;
  showCountdown: boolean;
  productIds: string[];
  categoryIds: string[];
};

export type CouponPricing = {
  id: string;
  code: string;
  title: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startAt: Date;
  endAt: Date;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  isActive: boolean;
  scope: PromotionScope;
  allowOnFlashSale: boolean;
  allowStacking: boolean;
  productIds: string[];
  categoryIds: string[];
  excludedProductIds: string[];
};

export type DistrictPricing = {
  id: string;
  name: string;
  deliveryCharge: number;
  isFreeDelivery: boolean;
  isActive: boolean;
  estimatedDays: string | null;
};

export type ShippingConfig = {
  defaultCharge: number;
  freeDeliveryOverAmount: number | null;
  mixedCartStrategy: "highest" | "sum" | "district_only";
};

export type CartLineInput = {
  /** Stable key (cart item id) so the UI can address the line. */
  key: string;
  quantity: number;
  product: ProductPricing;
  variant: VariantPricing | null;
};

/* -------------------------------------------------------------------------- */
/* 1–3. Effective unit price                                                   */
/* -------------------------------------------------------------------------- */

export type PriceSource = "BASE" | "VARIANT" | "FLASH_SALE" | "OFFER";

export type ResolvedPrice = {
  /** The catalogue price before any campaign (variant price wins over base). */
  listPrice: number;
  /** What the customer pays per unit right now. */
  unitPrice: number;
  compareAtPrice: number | null;
  source: PriceSource;
  flashSaleItemId: string | null;
  flashSaleEndsAt: Date | null;
  offerId: string | null;
  offerTitle: string | null;
  offerEndsAt: Date | null;
  offerBadge: string | null;
  showCountdown: boolean;
};

function isWindowActive(startAt: Date, endAt: Date, now: Date): boolean {
  return startAt.getTime() <= now.getTime() && endAt.getTime() > now.getTime();
}

/** Flash sale row that applies to this exact product/variant, if any. */
export function findFlashSaleItem(
  items: FlashSaleItemPricing[],
  productId: string,
  variantId: string | null,
  now: Date,
): FlashSaleItemPricing | null {
  const candidates = items.filter(
    (item) =>
      item.productId === productId &&
      (item.variantId === null || item.variantId === variantId) &&
      isWindowActive(item.startAt, item.endAt, now) &&
      (item.stockLimit === null || item.soldCount < item.stockLimit),
  );
  if (candidates.length === 0) return null;
  // A variant-specific row beats a product-wide one; otherwise take the cheapest.
  candidates.sort((a, b) => {
    if ((a.variantId === null) !== (b.variantId === null)) return a.variantId === null ? 1 : -1;
    return a.salePrice - b.salePrice;
  });
  return candidates[0] ?? null;
}

export function offerApplies(offer: OfferPricing, product: ProductPricing, now: Date): boolean {
  if (!isWindowActive(offer.startAt, offer.endAt, now)) return false;
  switch (offer.scope) {
    case "GLOBAL":
      return true;
    case "PRODUCT":
      return offer.productIds.includes(product.id);
    case "CATEGORY":
      return Boolean(product.categoryId && offer.categoryIds.includes(product.categoryId));
    default:
      return false;
  }
}

/** Applies an offer's discount to a unit price, honouring the maximum cap. */
export function applyOfferToUnit(offer: OfferPricing, unitPrice: number): number {
  const raw =
    offer.discountType === "FIXED"
      ? offer.discountValue
      : percentOf(unitPrice, offer.discountValue);
  const capped = offer.maxDiscountAmount !== null ? Math.min(raw, offer.maxDiscountAmount) : raw;
  return Math.max(0, unitPrice - clampDiscount(capped, unitPrice));
}

/**
 * Resolves the price a single line is sold at.
 * Flash sale and offers both compete — the customer always gets the lower price.
 */
export function resolveUnitPrice(
  product: ProductPricing,
  variant: VariantPricing | null,
  flashSaleItems: FlashSaleItemPricing[],
  offers: OfferPricing[],
  now: Date,
): ResolvedPrice {
  const listPrice = variant ? variant.price : product.price;
  const compareAtPrice = variant ? variant.compareAtPrice : product.compareAtPrice;

  const resolved: ResolvedPrice = {
    listPrice,
    unitPrice: listPrice,
    compareAtPrice,
    source: variant ? "VARIANT" : "BASE",
    flashSaleItemId: null,
    flashSaleEndsAt: null,
    offerId: null,
    offerTitle: null,
    offerEndsAt: null,
    offerBadge: null,
    showCountdown: false,
  };

  const flash = findFlashSaleItem(flashSaleItems, product.id, variant?.id ?? null, now);
  if (flash && flash.salePrice < resolved.unitPrice) {
    resolved.unitPrice = flash.salePrice;
    resolved.source = "FLASH_SALE";
    resolved.flashSaleItemId = flash.id;
    resolved.flashSaleEndsAt = flash.endAt;
    resolved.showCountdown = true;
  }

  const applicable = offers
    .filter((offer) => offerApplies(offer, product, now))
    .sort((a, b) => b.priority - a.priority);

  for (const offer of applicable) {
    const candidate = applyOfferToUnit(offer, listPrice);
    if (candidate < resolved.unitPrice) {
      resolved.unitPrice = candidate;
      resolved.source = "OFFER";
      resolved.offerId = offer.id;
      resolved.offerTitle = offer.title;
      resolved.offerEndsAt = offer.endAt;
      resolved.offerBadge = offer.badgeText;
      resolved.showCountdown = offer.showCountdown;
      // Only the single best offer applies — offers never stack with each other.
      break;
    }
  }

  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Priced cart lines                                                           */
/* -------------------------------------------------------------------------- */

export type PricedLine = {
  key: string;
  quantity: number;
  product: ProductPricing;
  variant: VariantPricing | null;
  price: ResolvedPrice;
  /** listPrice × quantity */
  lineSubtotal: number;
  /** Savings from a flash sale on this line. */
  flashDiscount: number;
  /** Savings from a promotional offer on this line. */
  offerDiscount: number;
  /** Coupon discount allocated to this line (filled in later). */
  couponDiscount: number;
  /** (listPrice − unitPrice − couponShare) × quantity */
  lineTotal: number;
  availableStock: number;
  isAvailable: boolean;
  unavailableReason: string | null;
};

export function priceLines(
  lines: CartLineInput[],
  flashSaleItems: FlashSaleItemPricing[],
  offers: OfferPricing[],
  now: Date,
): PricedLine[] {
  return lines.map((line) => {
    const price = resolveUnitPrice(line.product, line.variant, flashSaleItems, offers, now);
    const lineSubtotal = price.listPrice * line.quantity;
    const perUnitSaving = price.listPrice - price.unitPrice;
    const totalSaving = perUnitSaving * line.quantity;

    const availableStock = line.variant ? line.variant.stock : line.product.stock;
    let unavailableReason: string | null = null;
    if (line.variant && !line.variant.isActive) unavailableReason = "This option is no longer available.";
    else if (availableStock <= 0) unavailableReason = "Out of stock.";
    else if (availableStock < line.quantity) unavailableReason = `Only ${availableStock} left in stock.`;

    return {
      key: line.key,
      quantity: line.quantity,
      product: line.product,
      variant: line.variant,
      price,
      lineSubtotal,
      flashDiscount: price.source === "FLASH_SALE" ? totalSaving : 0,
      offerDiscount: price.source === "OFFER" ? totalSaving : 0,
      couponDiscount: 0,
      lineTotal: price.unitPrice * line.quantity,
      availableStock,
      isAvailable: unavailableReason === null,
      unavailableReason,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* 4. Coupons                                                                  */
/* -------------------------------------------------------------------------- */

export type CouponEvaluation = {
  valid: boolean;
  reason: string | null;
  /** Total discount in minor units. */
  discount: number;
  /** The part of the cart the coupon was allowed to touch. */
  eligibleSubtotal: number;
  eligibleLineKeys: string[];
};

export type CouponContext = {
  now: Date;
  /** How many times this customer has already used the coupon. */
  customerUsageCount: number;
};

/** Is this line inside the coupon's eligibility rules? */
export function isLineCouponEligible(coupon: CouponPricing, line: PricedLine): boolean {
  if (coupon.excludedProductIds.includes(line.product.id)) return false;
  if (!coupon.allowOnFlashSale && line.price.source === "FLASH_SALE") return false;
  // Stacking off (the default) means a line already discounted by an offer
  // cannot also take the coupon.
  if (!coupon.allowStacking && line.price.source === "OFFER") return false;

  switch (coupon.scope) {
    case "GLOBAL":
      return true;
    case "PRODUCT":
      return coupon.productIds.includes(line.product.id);
    case "CATEGORY":
      return Boolean(line.product.categoryId && coupon.categoryIds.includes(line.product.categoryId));
    default:
      return false;
  }
}

/**
 * Validates a coupon against the live cart. Returns a *reason* rather than
 * throwing so the checkout page can explain exactly why a code was refused.
 */
export function evaluateCoupon(
  coupon: CouponPricing,
  lines: PricedLine[],
  context: CouponContext,
): CouponEvaluation {
  const empty = (reason: string): CouponEvaluation => ({
    valid: false,
    reason,
    discount: 0,
    eligibleSubtotal: 0,
    eligibleLineKeys: [],
  });

  if (!coupon.isActive) return empty("This coupon is no longer active.");
  if (coupon.startAt.getTime() > context.now.getTime()) return empty("This coupon is not active yet.");
  if (coupon.endAt.getTime() <= context.now.getTime()) return empty("This coupon has expired.");
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return empty("This coupon has reached its usage limit.");
  }
  if (coupon.perCustomerLimit !== null && context.customerUsageCount >= coupon.perCustomerLimit) {
    return empty("You have already used this coupon the maximum number of times.");
  }

  const eligibleLines = lines.filter((line) => line.isAvailable && isLineCouponEligible(coupon, line));
  if (eligibleLines.length === 0) {
    return empty("This coupon does not apply to the products in your cart.");
  }

  const cartTotal = lines.filter((line) => line.isAvailable).reduce((sum, line) => sum + line.lineTotal, 0);
  if (coupon.minOrderAmount > 0 && cartTotal < coupon.minOrderAmount) {
    return empty("Your cart does not meet the minimum order amount for this coupon.");
  }

  const eligibleSubtotal = eligibleLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const raw =
    coupon.discountType === "FIXED"
      ? coupon.discountValue
      : percentOf(eligibleSubtotal, coupon.discountValue);
  const capped = coupon.maxDiscountAmount !== null ? Math.min(raw, coupon.maxDiscountAmount) : raw;
  const discount = clampDiscount(capped, eligibleSubtotal);

  if (discount <= 0) return empty("This coupon does not reduce the price of your cart.");

  return {
    valid: true,
    reason: null,
    discount,
    eligibleSubtotal,
    eligibleLineKeys: eligibleLines.map((line) => line.key),
  };
}

/**
 * Spreads a coupon discount across the eligible lines proportionally, with the
 * rounding remainder going to the largest line so the parts always sum exactly
 * to the total. The per-line share is what the invoice records.
 */
export function allocateCouponDiscount(lines: PricedLine[], evaluation: CouponEvaluation): PricedLine[] {
  if (!evaluation.valid || evaluation.discount <= 0) return lines;

  const eligible = new Set(evaluation.eligibleLineKeys);
  const base = evaluation.eligibleSubtotal;
  if (base <= 0) return lines;

  let allocated = 0;
  const withShares = lines.map((line) => {
    if (!eligible.has(line.key)) return { ...line, couponDiscount: 0 };
    const share = Math.floor((evaluation.discount * line.lineTotal) / base);
    allocated += share;
    return { ...line, couponDiscount: share };
  });

  let remainder = evaluation.discount - allocated;
  if (remainder > 0) {
    const largest = withShares
      .filter((line) => eligible.has(line.key))
      .sort((a, b) => b.lineTotal - a.lineTotal)[0];
    if (largest) {
      largest.couponDiscount += remainder;
      remainder = 0;
    }
  }

  return withShares.map((line) => ({
    ...line,
    lineTotal: Math.max(0, line.lineTotal - line.couponDiscount),
  }));
}

/* -------------------------------------------------------------------------- */
/* 5. Delivery charge — 64 districts + product-level overrides                 */
/* -------------------------------------------------------------------------- */

export type ShippingBreakdownEntry = {
  label: string;
  amount: number;
  mode: ShippingMode | "FREE_THRESHOLD";
  note?: string;
};

export type ShippingQuote = {
  total: number;
  districtCharge: number;
  strategy: ShippingConfig["mixedCartStrategy"];
  districtName: string | null;
  estimatedDays: string | null;
  breakdown: ShippingBreakdownEntry[];
  freeReason: string | null;
};

/**
 * Deterministic mixed-cart rule (PRD update §4):
 *  - a product marked FREE never contributes a charge;
 *  - a product with a FIXED charge contributes that charge once, regardless of quantity;
 *  - everything else falls back to the delivery charge of the selected district;
 *  - `mixedCartStrategy` decides how those parts combine:
 *      highest        → the single largest applicable charge (default, customer friendly)
 *      sum            → district charge + every fixed surcharge
 *      district_only  → ignore product surcharges, always bill the district charge
 *  - a store-wide free-delivery threshold overrides all of the above.
 */
export function calculateShipping(
  lines: PricedLine[],
  district: DistrictPricing | null,
  config: ShippingConfig,
  discountedSubtotal: number,
): ShippingQuote {
  const available = lines.filter((line) => line.isAvailable);

  const base: ShippingQuote = {
    total: 0,
    districtCharge: 0,
    strategy: config.mixedCartStrategy,
    districtName: district?.name ?? null,
    estimatedDays: district?.estimatedDays ?? null,
    breakdown: [],
    freeReason: null,
  };

  if (available.length === 0) return base;

  if (!district) {
    // No district chosen yet — quote the configured default so the cart can
    // show an estimate, and mark it clearly.
    base.districtCharge = config.defaultCharge;
    base.total = config.defaultCharge;
    base.breakdown.push({
      label: "Estimated delivery",
      amount: config.defaultCharge,
      mode: "STANDARD",
      note: "Select your district at checkout for the exact charge.",
    });
    return base;
  }

  const districtCharge = district.isFreeDelivery ? 0 : district.deliveryCharge;
  base.districtCharge = districtCharge;

  if (district.isFreeDelivery) {
    base.freeReason = `Free delivery in ${district.name}.`;
    base.breakdown.push({ label: `Delivery to ${district.name}`, amount: 0, mode: "FREE" });
    return base;
  }

  const fixedSurcharges: ShippingBreakdownEntry[] = [];
  let hasStandardItem = false;
  const seenFixedProducts = new Set<string>();

  for (const line of available) {
    switch (line.product.shippingMode) {
      case "FREE":
        break;
      case "FIXED": {
        if (seenFixedProducts.has(line.product.id)) break;
        seenFixedProducts.add(line.product.id);
        fixedSurcharges.push({
          label: `${line.product.name} — product delivery charge`,
          amount: line.product.shippingFlatFee ?? 0,
          mode: "FIXED",
        });
        break;
      }
      default:
        hasStandardItem = true;
    }
  }

  const districtEntry: ShippingBreakdownEntry | null = hasStandardItem
    ? { label: `Delivery to ${district.name}`, amount: districtCharge, mode: "STANDARD" }
    : null;

  let total = 0;
  const breakdown: ShippingBreakdownEntry[] = [];

  switch (config.mixedCartStrategy) {
    case "sum": {
      if (districtEntry) { breakdown.push(districtEntry); total += districtEntry.amount; }
      for (const entry of fixedSurcharges) { breakdown.push(entry); total += entry.amount; }
      break;
    }
    case "district_only": {
      const entry = districtEntry ?? { label: `Delivery to ${district.name}`, amount: districtCharge, mode: "STANDARD" as const };
      if (available.every((line) => line.product.shippingMode === "FREE")) {
        breakdown.push({ label: "Free delivery on all items", amount: 0, mode: "FREE" });
      } else {
        breakdown.push(entry);
        total += entry.amount;
      }
      break;
    }
    case "highest":
    default: {
      const candidates = [...(districtEntry ? [districtEntry] : []), ...fixedSurcharges];
      if (candidates.length === 0) {
        breakdown.push({ label: "Free delivery on all items", amount: 0, mode: "FREE" });
      } else {
        const winner = candidates.reduce((max, entry) => (entry.amount > max.amount ? entry : max));
        breakdown.push(winner);
        total = winner.amount;
      }
      break;
    }
  }

  if (available.every((line) => line.product.shippingMode === "FREE")) {
    base.freeReason = "Free delivery applies to every item in your cart.";
  }

  if (config.freeDeliveryOverAmount !== null && discountedSubtotal >= config.freeDeliveryOverAmount && total > 0) {
    breakdown.push({
      label: "Free delivery threshold reached",
      amount: -total,
      mode: "FREE_THRESHOLD",
    });
    base.freeReason = "Your order qualifies for free delivery.";
    total = 0;
  }

  base.total = total;
  base.breakdown = breakdown;
  return base;
}

/* -------------------------------------------------------------------------- */
/* 6. The full quote                                                           */
/* -------------------------------------------------------------------------- */

export type CartQuote = {
  lines: PricedLine[];
  unavailableLines: PricedLine[];
  itemCount: number;
  /** Σ listPrice × qty */
  subtotal: number;
  flashDiscount: number;
  offerDiscount: number;
  couponDiscount: number;
  totalDiscount: number;
  shipping: ShippingQuote;
  grandTotal: number;
  coupon: { code: string; title: string; evaluation: CouponEvaluation } | null;
  couponError: string | null;
};

export type QuoteInput = {
  lines: CartLineInput[];
  flashSaleItems: FlashSaleItemPricing[];
  offers: OfferPricing[];
  coupon: CouponPricing | null;
  /**
   * The code the shopper actually typed. Needed separately from `coupon`
   * because an unknown code loads as null, and "no such coupon" has to be
   * reported as a failure rather than passing silently as no coupon at all.
   */
  requestedCouponCode?: string | null;
  couponContext: CouponContext;
  district: DistrictPricing | null;
  shippingConfig: ShippingConfig;
  now: Date;
};

/** The single function checkout, cart and invoicing all agree on. */
export function quoteCart(input: QuoteInput): CartQuote {
  const priced = priceLines(input.lines, input.flashSaleItems, input.offers, input.now);
  const available = priced.filter((line) => line.isAvailable);
  const unavailable = priced.filter((line) => !line.isAvailable);

  let couponEvaluation: CouponEvaluation | null = null;
  let couponError: string | null = null;
  let finalLines = priced;

  if (input.coupon) {
    couponEvaluation = evaluateCoupon(input.coupon, available, input.couponContext);
    if (couponEvaluation.valid) {
      finalLines = allocateCouponDiscount(priced, couponEvaluation);
    } else {
      couponError = couponEvaluation.reason;
    }
  } else if (input.requestedCouponCode) {
    couponError = `Coupon "${input.requestedCouponCode}" is not valid.`;
  }

  const finalAvailable = finalLines.filter((line) => line.isAvailable);

  const subtotal = finalAvailable.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const flashDiscount = finalAvailable.reduce((sum, line) => sum + line.flashDiscount, 0);
  const offerDiscount = finalAvailable.reduce((sum, line) => sum + line.offerDiscount, 0);
  const couponDiscount = finalAvailable.reduce((sum, line) => sum + line.couponDiscount, 0);
  const discountedSubtotal = subtotal - flashDiscount - offerDiscount - couponDiscount;

  const shipping = calculateShipping(finalAvailable, input.district, input.shippingConfig, discountedSubtotal);

  return {
    lines: finalLines,
    unavailableLines: unavailable,
    itemCount: finalAvailable.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    flashDiscount,
    offerDiscount,
    couponDiscount,
    totalDiscount: flashDiscount + offerDiscount + couponDiscount,
    shipping,
    grandTotal: Math.max(0, discountedSubtotal + shipping.total),
    coupon:
      input.coupon && couponEvaluation?.valid
        ? { code: input.coupon.code, title: input.coupon.title, evaluation: couponEvaluation }
        : null,
    couponError,
  };
}
