import { z } from "zod";
import {
  booleanSchema, idSchema, optionalIdSchema, moneyInputSchema, optionalMoneySchema, optionalSlugSchema,
  optionalText, optionalUrlSchema, requiredText, stockSchema,
} from "./common";

export const categorySchema = z.object({
  name: requiredText("Category name", 120),
  slug: optionalSlugSchema,
  parentId: optionalIdSchema,
  description: optionalText(2000),
  imageUrl: optionalUrlSchema,
  bannerUrl: optionalUrlSchema,
  iconName: optionalText(60),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: booleanSchema.default(true),
  showInMenu: booleanSchema.default(true),
  isFeatured: booleanSchema.default(false),
});

export const brandSchema = z.object({
  name: requiredText("Brand name", 120),
  slug: optionalSlugSchema,
  logoUrl: optionalUrlSchema,
  description: optionalText(2000),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: booleanSchema.default(true),
});

export const attributeSchema = z.object({
  name: requiredText("Attribute name", 60),
  slug: optionalSlugSchema,
  type: z.enum(["SELECT", "COLOR", "TEXT"]).default("SELECT"),
  unit: optionalText(20),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isActive: booleanSchema.default(true),
  /** Newline or comma separated option values. */
  options: z.string().max(4000).optional().default(""),
});

export const productSchema = z.object({
  name: requiredText("Product name", 200),
  slug: optionalSlugSchema,
  sku: optionalText(60),
  categoryId: optionalIdSchema,
  brandId: optionalIdSchema,
  shortDescription: optionalText(500),
  description: optionalText(20000),
  specifications: optionalText(8000),
  price: moneyInputSchema,
  compareAtPrice: optionalMoneySchema,
  costPrice: optionalMoneySchema,
  stock: stockSchema.default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(10000).default(5),
  weightGrams: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  tags: z.string().max(600).optional().default(""),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  isFeatured: booleanSchema.default(false),
  isTopSelling: booleanSchema.default(false),
  manualRank: z.coerce.number().int().min(0).max(9999).default(0),
  shippingMode: z.enum(["STANDARD", "FREE", "FIXED"]).default("STANDARD"),
  shippingFlatFee: optionalMoneySchema,
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  canonicalUrl: optionalUrlSchema,
  ogImageUrl: optionalUrlSchema,
  noIndex: booleanSchema.default(false),
}).refine(
  (data) => data.shippingMode !== "FIXED" || (data.shippingFlatFee ?? 0) > 0,
  { message: "Enter the fixed delivery charge for this product.", path: ["shippingFlatFee"] },
).refine(
  (data) => data.compareAtPrice === null || data.compareAtPrice > data.price,
  { message: "Compare-at price must be higher than the selling price.", path: ["compareAtPrice"] },
);

export const productImageSchema = z.object({
  productId: idSchema,
  url: z.string().url().max(2048),
  publicId: optionalText(200),
  alt: optionalText(200),
  isPrimary: booleanSchema.default(false),
});

/** One row of the variant matrix editor. */
export const variantRowSchema = z.object({
  id: z.string().optional(),
  name: requiredText("Variant name", 160),
  sku: optionalText(60),
  price: moneyInputSchema,
  compareAtPrice: optionalMoneySchema,
  stock: stockSchema.default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(10000).default(5),
  barcode: optionalText(60),
  weightGrams: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  imageUrl: optionalUrlSchema,
  isActive: booleanSchema.default(true),
  /** attributeId:optionId pairs describing this combination. */
  optionIds: z.array(z.string()).default([]),
});

export const variantsPayloadSchema = z.object({
  productId: idSchema,
  attributeIds: z.array(idSchema).max(6, "Use at most 6 attributes per product."),
  variants: z.array(variantRowSchema).max(300, "A product can have at most 300 variants."),
});

export const inventoryAdjustSchema = z.object({
  productId: idSchema,
  variantId: optionalIdSchema,
  quantityChange: z.coerce.number().int().min(-100000).max(100000).refine((v) => v !== 0, "Enter a non-zero change."),
  reason: requiredText("Reason", 200),
});

export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
