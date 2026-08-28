import { toDateTimeLocalValue } from "@/lib/utils";

/**
 * Blank starting values for the coupon and offer editors.
 *
 * These live outside the form components because those are client components:
 * a server component may render a client component, but it cannot *call* a
 * function exported from one. The "new" pages need these defaults on the
 * server, so the factories belong in a module neither side owns.
 */

export type CouponFormValues = {
  id?: string;
  code: string;
  title: string;
  description: string;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startAt: string;
  endAt: string;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  isActive: boolean;
  scope: "GLOBAL" | "PRODUCT" | "CATEGORY";
  allowOnFlashSale: boolean;
  allowStacking: boolean;
  productIds: string[];
  categoryIds: string[];
  excludedProductIds: string[];
};

export type OfferFormValues = {
  id?: string;
  title: string;
  description: string;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  maxDiscountAmount: number | null;
  scope: "GLOBAL" | "PRODUCT" | "CATEGORY";
  startAt: string;
  endAt: string;
  isActive: boolean;
  priority: number;
  badgeText: string;
  showCountdown: boolean;
  productIds: string[];
  categoryIds: string[];
};

export function emptyCoupon(): CouponFormValues {
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    code: "", title: "", description: "",
    discountType: "PERCENT", discountValue: 10,
    minOrderAmount: 0, maxDiscountAmount: null,
    startAt: toDateTimeLocalValue(now), endAt: toDateTimeLocalValue(inAWeek),
    usageLimit: null, perCustomerLimit: 1, isActive: true,
    scope: "GLOBAL", allowOnFlashSale: false, allowStacking: false,
    productIds: [], categoryIds: [], excludedProductIds: [],
  };
}

/** Defaults to a two-hour window so short campaigns are the easy path. */
export function emptyOffer(): OfferFormValues {
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return {
    title: "", description: "", discountType: "PERCENT", discountValue: 10,
    maxDiscountAmount: null, scope: "PRODUCT",
    startAt: toDateTimeLocalValue(now), endAt: toDateTimeLocalValue(inTwoHours),
    isActive: true, priority: 0, badgeText: "Offer", showCountdown: true,
    productIds: [], categoryIds: [],
  };
}
