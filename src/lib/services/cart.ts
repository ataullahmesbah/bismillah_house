import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { errors } from "@/lib/api";
import { randomToken } from "@/lib/ids";
import { CART_COOKIE, getCurrentUser } from "@/lib/auth/session";
import { getSettingGroup } from "@/lib/settings";
import { optimizedImage } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { getPricingContext } from "./catalog";
import {
  quoteCart,
  type CartLineInput, type CartQuote, type CouponPricing, type DistrictPricing,
} from "./pricing";

const CART_TTL_DAYS = 30;

/* -------------------------------------------------------------------------- */
/* Cart resolution                                                             */
/* -------------------------------------------------------------------------- */

/** Reads the caller's cart without creating one. */
export const findCart = cache(async () => {
  const user = await getCurrentUser();
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;

  if (user) {
    const owned = await prisma.cart.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    if (owned) return owned;
  }
  if (!token) return null;
  return prisma.cart.findUnique({ where: { token } });
});

/**
 * Returns the caller's cart, creating one if needed. When a guest signs in,
 * their guest cart is merged into the account cart.
 */
export async function getOrCreateCart(): Promise<{ id: string; token: string }> {
  const user = await getCurrentUser();
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const expiresAt = new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);

  const guestCart = token ? await prisma.cart.findUnique({ where: { token } }) : null;

  if (user) {
    const userCart =
      (await prisma.cart.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } })) ??
      (await prisma.cart.create({
        data: { token: randomToken(24), userId: user.id, expiresAt },
      }));

    if (guestCart && guestCart.id !== userCart.id && !guestCart.userId) {
      await mergeCarts(guestCart.id, userCart.id);
    }
    await setCartCookie(userCart.token);
    return { id: userCart.id, token: userCart.token };
  }

  if (guestCart) {
    await prisma.cart.update({ where: { id: guestCart.id }, data: { expiresAt } });
    return { id: guestCart.id, token: guestCart.token };
  }

  const created = await prisma.cart.create({ data: { token: randomToken(24), expiresAt } });
  await setCartCookie(created.token);
  return { id: created.id, token: created.token };
}

async function setCartCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: CART_TTL_DAYS * 24 * 60 * 60,
  });
}

/** Moves guest cart lines into the signed-in cart, summing duplicate quantities. */
async function mergeCarts(fromCartId: string, intoCartId: string): Promise<void> {
  const items = await prisma.cartItem.findMany({ where: { cartId: fromCartId } });
  for (const item of items) {
    await prisma.cartItem.upsert({
      where: {
        cartId_productId_variantKey: {
          cartId: intoCartId,
          productId: item.productId,
          variantKey: item.variantKey,
        },
      },
      create: {
        cartId: intoCartId,
        productId: item.productId,
        variantId: item.variantId,
        variantKey: item.variantKey,
        quantity: item.quantity,
      },
      update: { quantity: { increment: item.quantity } },
    });
  }
  await prisma.cart.delete({ where: { id: fromCartId } }).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

export async function addToCart(productId: string, variantId: string | null, quantity: number): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED", deletedAt: null },
    select: { id: true, hasVariants: true, stock: true, name: true },
  });
  if (!product) throw errors.notFound("This product is no longer available.");

  let stock = product.stock;
  if (product.hasVariants) {
    if (!variantId) throw errors.validation("Choose an option before adding to cart.");
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId, isActive: true },
      select: { stock: true },
    });
    if (!variant) throw errors.validation("That option is not available.");
    stock = variant.stock;
  } else if (variantId) {
    // Reject a variant id smuggled in for a product that has none.
    throw errors.validation("That option is not available.");
  }

  if (stock <= 0) throw errors.conflict(`${product.name} is out of stock.`);

  const cart = await getOrCreateCart();
  const variantKey = variantId ?? "";

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId_variantKey: { cartId: cart.id, productId, variantKey } },
    select: { quantity: true },
  });
  const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, stock, 999);

  await prisma.cartItem.upsert({
    where: { cartId_productId_variantKey: { cartId: cart.id, productId, variantKey } },
    create: { cartId: cart.id, productId, variantId, variantKey, quantity: nextQuantity },
    update: { quantity: nextQuantity },
  });
}

export async function updateCartItemQuantity(itemId: string, quantity: number): Promise<void> {
  const cart = await findCart();
  if (!cart) throw errors.notFound("Your cart is empty.");

  // Ownership check — an item id from another cart is rejected.
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    select: { id: true, productId: true, variantId: true },
  });
  if (!item) throw errors.notFound("That item is no longer in your cart.");

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }

  const stock = item.variantId
    ? (await prisma.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true } }))?.stock ?? 0
    : (await prisma.product.findUnique({ where: { id: item.productId }, select: { stock: true } }))?.stock ?? 0;

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: Math.max(1, Math.min(quantity, stock || 1, 999)) },
  });
}

export async function removeCartItem(itemId: string): Promise<void> {
  const cart = await findCart();
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
}

export async function clearCart(cartId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

/* -------------------------------------------------------------------------- */
/* Quoting                                                                     */
/* -------------------------------------------------------------------------- */

export type CartLineView = {
  itemId: string;
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  variantName: string | null;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  listPrice: number;
  unitPrice: number;
  lineTotal: number;
  couponDiscount: number;
  badge: string | null;
  shippingMode: "STANDARD" | "FREE" | "FIXED";
  availableStock: number;
  isAvailable: boolean;
  unavailableReason: string | null;
};

export type CartView = {
  cartId: string | null;
  lines: CartLineView[];
  quote: CartQuote;
  isEmpty: boolean;
  hasUnavailable: boolean;
};

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, price: true, compareAtPrice: true, stock: true,
          hasVariants: true, categoryId: true, shippingMode: true, shippingFlatFee: true,
          status: true, deletedAt: true,
          images: {
            select: { url: true, alt: true },
            orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
            take: 1,
          },
        },
      },
      variant: {
        select: {
          id: true, name: true, sku: true, price: true, compareAtPrice: true,
          stock: true, isActive: true, imageUrl: true,
          options: { select: { attribute: { select: { name: true } }, option: { select: { label: true } } } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

/** Loads a coupon with all of its eligibility relations. */
export async function loadCoupon(code: string): Promise<CouponPricing | null> {
  const coupon = await prisma.coupon.findFirst({
    where: { code: code.toUpperCase().trim(), deletedAt: null },
    include: {
      products: { select: { productId: true } },
      categories: { select: { categoryId: true } },
      exclusions: { select: { productId: true } },
    },
  });
  if (!coupon) return null;

  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount,
    maxDiscountAmount: coupon.maxDiscountAmount,
    startAt: coupon.startAt,
    endAt: coupon.endAt,
    usageLimit: coupon.usageLimit,
    usageCount: coupon.usageCount,
    perCustomerLimit: coupon.perCustomerLimit,
    isActive: coupon.isActive,
    scope: coupon.scope,
    allowOnFlashSale: coupon.allowOnFlashSale,
    allowStacking: coupon.allowStacking,
    productIds: coupon.products.map((row) => row.productId),
    categoryIds: coupon.categories.map((row) => row.categoryId),
    excludedProductIds: coupon.exclusions.map((row) => row.productId),
  };
}

async function countCustomerRedemptions(
  couponId: string,
  userId: string | null,
  email: string | null,
): Promise<number> {
  if (!userId && !email) return 0;
  return prisma.couponRedemption.count({
    where: {
      couponId,
      OR: [...(userId ? [{ userId }] : []), ...(email ? [{ email }] : [])],
    },
  });
}

export type QuoteOptions = {
  couponCode?: string | null;
  districtId?: string | null;
  /** Used for a guest's per-customer coupon limit. */
  guestEmail?: string | null;
};

/**
 * Prices the caller's cart from scratch against live database rows.
 * This is the only price the server ever trusts.
 */
export async function getCartView(options: QuoteOptions = {}): Promise<CartView> {
  const cart = await findCart();

  const [pricingContext, shippingConfig, user] = await Promise.all([
    getPricingContext(),
    getSettingGroup("shipping"),
    getCurrentUser(),
  ]);

  const cartWithItems = cart
    ? await prisma.cart.findUnique({ where: { id: cart.id }, include: CART_INCLUDE })
    : null;

  const rawItems = (cartWithItems?.items ?? []).filter(
    (item) => item.product && item.product.status === "PUBLISHED" && !item.product.deletedAt,
  );

  const lines: CartLineInput[] = rawItems.map((item) => ({
    key: item.id,
    quantity: item.quantity,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      categoryId: item.product.categoryId,
      price: item.product.price,
      compareAtPrice: item.product.compareAtPrice,
      stock: item.product.stock,
      hasVariants: item.product.hasVariants,
      shippingMode: item.product.shippingMode,
      shippingFlatFee: item.product.shippingFlatFee,
      imageUrl: item.product.images[0]?.url ?? null,
    },
    variant: item.variant
      ? {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku,
          price: item.variant.price,
          compareAtPrice: item.variant.compareAtPrice,
          stock: item.variant.stock,
          isActive: item.variant.isActive,
          imageUrl: item.variant.imageUrl,
          attributes: item.variant.options.map((row) => ({
            attribute: row.attribute.name,
            value: row.option.label,
          })),
        }
      : null,
  }));

  const [coupon, district] = await Promise.all([
    options.couponCode ? loadCoupon(options.couponCode) : Promise.resolve(null),
    options.districtId
      ? prisma.district.findFirst({
          where: { id: options.districtId, isActive: true },
          select: {
            id: true, name: true, deliveryCharge: true,
            isFreeDelivery: true, isActive: true, estimatedDays: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const customerUsageCount = coupon
    ? await countCustomerRedemptions(coupon.id, user?.id ?? null, options.guestEmail ?? user?.email ?? null)
    : 0;

  const quote = quoteCart({
    lines,
    flashSaleItems: pricingContext.flashSaleItems,
    offers: pricingContext.offers,
    coupon,
    requestedCouponCode: options.couponCode ?? null,
    couponContext: { now: pricingContext.now, customerUsageCount },
    district: district as DistrictPricing | null,
    shippingConfig,
    now: pricingContext.now,
  });

  const lineViews: CartLineView[] = quote.lines.map((line) => ({
    itemId: line.key,
    productId: line.product.id,
    variantId: line.variant?.id ?? null,
    name: line.product.name,
    slug: line.product.slug,
    variantName: line.variant?.name ?? null,
    sku: line.variant?.sku ?? null,
    imageUrl: optimizedImage(line.variant?.imageUrl ?? line.product.imageUrl ?? null, 200),
    quantity: line.quantity,
    listPrice: line.price.listPrice,
    unitPrice: line.price.unitPrice,
    lineTotal: line.lineTotal,
    couponDiscount: line.couponDiscount,
    badge:
      line.price.source === "FLASH_SALE"
        ? "Flash Sale"
        : line.price.source === "OFFER"
          ? (line.price.offerBadge ?? "Offer")
          : null,
    shippingMode: line.product.shippingMode,
    availableStock: line.availableStock,
    isAvailable: line.isAvailable,
    unavailableReason: line.unavailableReason,
  }));

  return {
    cartId: cart?.id ?? null,
    lines: lineViews,
    quote,
    isEmpty: lineViews.length === 0,
    hasUnavailable: quote.unavailableLines.length > 0,
  };
}

/** Small badge count for the header. */
export const getCartCount = cache(async (): Promise<number> => {
  const cart = await findCart();
  if (!cart) return 0;
  const result = await prisma.cartItem.aggregate({
    where: { cartId: cart.id },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
});
