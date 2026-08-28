import { z } from "zod";
import {
  booleanSchema, dateTimeSchema, emailSchema, idSchema, moneyInputSchema, nameSchema,
  optionalDateTimeSchema, optionalEmailSchema, optionalIdSchema, optionalMoneySchema,
  optionalPhoneSchema, optionalText, phoneSchema, quantitySchema, requiredText,
} from "./common";

/* -------------------------------------------------------------------------- */
/* Cart                                                                        */
/* -------------------------------------------------------------------------- */

export const addToCartSchema = z.object({
  productId: idSchema,
  variantId: optionalIdSchema,
  quantity: quantitySchema.default(1),
});

export const updateCartItemSchema = z.object({
  itemId: idSchema,
  quantity: z.coerce.number().int().min(0).max(999),
});

/* -------------------------------------------------------------------------- */
/* Address & checkout                                                          */
/* -------------------------------------------------------------------------- */

export const addressSchema = z.object({
  label: optionalText(40),
  type: z.enum(["HOME", "OFFICE", "OTHER"]).default("HOME"),
  fullName: nameSchema,
  phone: phoneSchema,
  districtId: idSchema,
  city: optionalText(80),
  area: optionalText(120),
  addressLine1: requiredText("Address", 300),
  addressLine2: optionalText(300),
  postalCode: optionalText(12),
  isDefault: booleanSchema.default(false),
});

export const checkoutSchema = z.object({
  // Contact
  fullName: nameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,

  // Delivery — an existing saved address, or a new one typed at checkout.
  addressId: optionalIdSchema,
  districtId: idSchema,
  city: optionalText(80),
  area: optionalText(120),
  addressLine1: requiredText("Delivery address", 300),
  addressLine2: optionalText(300),
  postalCode: optionalText(12),

  paymentMethod: z.enum(["COD", "BKASH", "SSLCOMMERZ"]).default("COD"),
  bkashTransactionId: optionalText(60),
  bkashSenderNumber: optionalPhoneSchema,
  couponCode: optionalText(40),
  customerNote: optionalText(1000),
  saveAddress: booleanSchema.default(false),
}).refine(
  (data) => data.paymentMethod !== "BKASH" || Boolean(data.bkashTransactionId),
  { message: "Enter your bKash transaction ID.", path: ["bkashTransactionId"] },
).refine(
  (data) => data.paymentMethod !== "BKASH" || Boolean(data.bkashSenderNumber),
  { message: "Enter the bKash number you paid from.", path: ["bkashSenderNumber"] },
);

export const applyCouponSchema = z.object({
  code: requiredText("Coupon code", 40).transform((v) => v.toUpperCase()),
});

export const trackOrderSchema = z.object({
  reference: requiredText("Order number or tracking code", 80),
  phone: z.string().trim().min(4, "Enter the phone number used on the order.").max(20),
});

/* -------------------------------------------------------------------------- */
/* Orders (staff)                                                              */
/* -------------------------------------------------------------------------- */

export const orderStatusSchema = z.object({
  orderId: idSchema,
  status: z.enum([
    "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY",
    "DELIVERED", "CANCELLED", "REJECTED", "RETURNED", "REFUNDED", "FAILED", "FRAUD_REVIEW",
  ]),
  note: optionalText(500),
});

export const orderNoteSchema = z.object({
  orderId: idSchema,
  note: requiredText("Note", 2000),
});

export const paymentUpdateSchema = z.object({
  orderId: idSchema,
  paymentStatus: z.enum([
    "UNPAID", "PENDING", "PAID", "PARTIALLY_PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED",
  ]),
  paidAmount: optionalMoneySchema,
  transactionId: optionalText(80),
});

export const refundSchema = z.object({
  orderId: idSchema,
  amount: moneyInputSchema,
  reason: requiredText("Reason", 400),
});

export const customerHistorySearchSchema = z.object({
  query: requiredText("Phone number or email", 120),
});

/* -------------------------------------------------------------------------- */
/* Promotions                                                                  */
/* -------------------------------------------------------------------------- */

export const couponSchema = z.object({
  code: requiredText("Coupon code", 40)
    .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9_-]{3,40}$/, "Use 3–40 letters, numbers, dashes or underscores.")),
  title: requiredText("Title", 160),
  description: optionalText(600),
  discountType: z.enum(["FIXED", "PERCENT"]),
  discountValue: z.coerce.number().min(0.01, "Enter a discount value."),
  minOrderAmount: moneyInputSchema.default(0),
  maxDiscountAmount: optionalMoneySchema,
  startAt: dateTimeSchema,
  endAt: dateTimeSchema,
  usageLimit: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  perCustomerLimit: z.coerce.number().int().min(0).max(1000).optional().nullable(),
  isActive: booleanSchema.default(true),
  scope: z.enum(["GLOBAL", "PRODUCT", "CATEGORY"]).default("GLOBAL"),
  allowOnFlashSale: booleanSchema.default(false),
  allowStacking: booleanSchema.default(false),
  productIds: z.array(idSchema).default([]),
  categoryIds: z.array(idSchema).default([]),
  excludedProductIds: z.array(idSchema).default([]),
})
  .refine((data) => data.endAt > data.startAt, { message: "End time must be after the start time.", path: ["endAt"] })
  .refine((data) => data.discountType !== "PERCENT" || data.discountValue <= 100, {
    message: "A percentage discount cannot exceed 100%.", path: ["discountValue"],
  })
  .refine((data) => data.scope !== "PRODUCT" || data.productIds.length > 0, {
    message: "Select at least one product for a product-specific coupon.", path: ["productIds"],
  })
  .refine((data) => data.scope !== "CATEGORY" || data.categoryIds.length > 0, {
    message: "Select at least one category for a category coupon.", path: ["categoryIds"],
  });

export const offerSchema = z.object({
  title: requiredText("Offer title", 160),
  description: optionalText(600),
  discountType: z.enum(["FIXED", "PERCENT"]),
  discountValue: z.coerce.number().min(0.01, "Enter a discount value."),
  maxDiscountAmount: optionalMoneySchema,
  scope: z.enum(["GLOBAL", "PRODUCT", "CATEGORY"]).default("PRODUCT"),
  startAt: dateTimeSchema,
  endAt: dateTimeSchema,
  isActive: booleanSchema.default(true),
  priority: z.coerce.number().int().min(0).max(999).default(0),
  badgeText: optionalText(40),
  showCountdown: booleanSchema.default(true),
  productIds: z.array(idSchema).default([]),
  categoryIds: z.array(idSchema).default([]),
})
  .refine((data) => data.endAt > data.startAt, { message: "End time must be after the start time.", path: ["endAt"] })
  .refine((data) => data.discountType !== "PERCENT" || data.discountValue <= 100, {
    message: "A percentage discount cannot exceed 100%.", path: ["discountValue"],
  })
  .refine((data) => data.scope !== "PRODUCT" || data.productIds.length > 0, {
    message: "Select at least one product.", path: ["productIds"],
  });

export const flashSaleSchema = z.object({
  title: requiredText("Flash sale title", 160),
  description: optionalText(600),
  bannerUrl: optionalText(2048),
  startAt: dateTimeSchema,
  endAt: dateTimeSchema,
  isActive: booleanSchema.default(true),
  position: z.coerce.number().int().min(0).max(999).default(0),
}).refine((data) => data.endAt > data.startAt, {
  message: "End time must be after the start time.", path: ["endAt"],
});

export const flashSaleItemSchema = z.object({
  flashSaleId: idSchema,
  productId: idSchema,
  variantId: optionalIdSchema,
  salePrice: moneyInputSchema,
  stockLimit: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
});

export const bannerSchema = z.object({
  title: requiredText("Title", 160),
  subtitle: optionalText(300),
  placement: z.enum([
    "HOME_HERO", "HOME_BILLBOARD", "HOME_STRIP", "CATEGORY_TOP",
    "PRODUCT_SIDEBAR", "POPUP", "ANNOUNCEMENT",
  ]),
  imageUrl: optionalText(2048),
  mobileImageUrl: optionalText(2048),
  alt: optionalText(200),
  linkUrl: optionalText(2048),
  ctaLabel: optionalText(60),
  secondaryLinkUrl: optionalText(2048),
  secondaryCtaLabel: optionalText(60),
  htmlContent: optionalText(4000),
  priority: z.coerce.number().int().min(0).max(999).default(0),
  startAt: optionalDateTimeSchema,
  endAt: optionalDateTimeSchema,
  isActive: booleanSchema.default(true),
  frequencyHours: z.coerce.number().int().min(0).max(720).default(24),
});

/* -------------------------------------------------------------------------- */
/* Reviews, messages, contact                                                  */
/* -------------------------------------------------------------------------- */

export const reviewSchema = z.object({
  productId: idSchema,
  orderItemId: optionalIdSchema,
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  title: optionalText(160),
  body: requiredText("Review", 3000),
});

export const reviewModerationSchema = z.object({
  reviewId: idSchema,
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  reply: optionalText(2000),
});

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  subject: requiredText("Subject", 200),
  message: requiredText("Message", 4000),
});

export const conversationSchema = z.object({
  subject: requiredText("Subject", 200),
  message: requiredText("Message", 4000),
  orderId: optionalIdSchema,
});

export const messageSchema = z.object({
  conversationId: idSchema,
  body: requiredText("Message", 4000),
  isInternal: booleanSchema.default(false),
});

/* -------------------------------------------------------------------------- */
/* Shipping                                                                    */
/* -------------------------------------------------------------------------- */

export const districtSchema = z.object({
  id: idSchema,
  deliveryCharge: moneyInputSchema,
  isFreeDelivery: booleanSchema.default(false),
  isActive: booleanSchema.default(true),
  estimatedDays: optionalText(20),
});

export const bulkDistrictSchema = z.object({
  defaultCharge: moneyInputSchema,
  /** Districts left untouched by the bulk update (usually Dhaka). */
  excludeIds: z.array(idSchema).default([]),
  applyToInactive: booleanSchema.default(false),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
