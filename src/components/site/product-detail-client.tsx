"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { Price } from "@/components/ui";
import { AddToCartForm } from "./add-to-cart";
import { Countdown } from "./countdown";
import { trackViewItem } from "./analytics";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { ProductDetail } from "@/lib/services/products";

/**
 * Variant picker + gallery.
 *
 * Selecting options narrows to a single variant and swaps price, stock, SKU and
 * image. Combinations that no active variant provides are shown disabled, so an
 * invalid pair can never be submitted — and the server re-validates anyway.
 */
export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  // The chosen image is stored together with the variant it belongs to, so
  // switching variant resets the gallery during render rather than in an effect.
  const [imageChoice, setImageChoice] = useState<{ variantId: string | null; index: number }>({
    variantId: null,
    index: 0,
  });

  const activeVariant = useMemo(() => {
    if (!product.hasVariants || product.attributes.length === 0) return null;
    const chosen = product.attributes.map((attribute) => selected[attribute.id]).filter(Boolean);
    if (chosen.length !== product.attributes.length) return null;
    return (
      product.variants.find((variant) =>
        chosen.every((optionId) => variant.optionIds.includes(optionId as string)),
      ) ?? null
    );
  }, [product, selected]);

  /** Which option ids can still lead to a real variant given the current picks. */
  const reachableOptionIds = useMemo(() => {
    const reachable = new Set<string>();
    for (const attribute of product.attributes) {
      const otherPicks = Object.entries(selected)
        .filter(([attributeId]) => attributeId !== attribute.id)
        .map(([, optionId]) => optionId);

      for (const option of attribute.options) {
        const matches = product.variants.some(
          (variant) =>
            variant.stock > 0 &&
            variant.optionIds.includes(option.id) &&
            otherPicks.every((pick) => variant.optionIds.includes(pick)),
        );
        if (matches) reachable.add(option.id);
      }
    }
    return reachable;
  }, [product, selected]);

  const needsSelection = product.hasVariants && product.attributes.length > 0 && !activeVariant;
  const unitPrice = activeVariant ? activeVariant.unitPrice : product.price.unitPrice;
  const listPrice = activeVariant ? activeVariant.price : product.price.listPrice;
  const compareAt = activeVariant ? activeVariant.compareAtPrice : product.price.compareAtPrice;
  const stock = activeVariant ? activeVariant.stock : product.hasVariants
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : product.stock;
  const sku = activeVariant?.sku ?? product.sku;
  const badge = activeVariant?.badge ?? (product.price.source === "FLASH_SALE"
    ? "Flash Sale"
    : product.price.source === "OFFER" ? (product.price.offerBadge ?? "Offer") : null);

  const images = useMemo(() => {
    const base = product.images.map((image) => image.url);
    if (activeVariant?.imageUrl && !base.includes(activeVariant.imageUrl)) {
      return [activeVariant.imageUrl, ...base];
    }
    return base;
  }, [product.images, activeVariant]);

  useEffect(() => {
    trackViewItem({
      item_id: product.id,
      item_name: product.name,
      price: unitPrice / 100,
      item_category: product.category?.name,
    });
    // Fire once per product, not on every variant change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const activeVariantId = activeVariant?.id ?? null;
  const activeImage = imageChoice.variantId === activeVariantId ? Math.min(imageChoice.index, images.length - 1) : 0;
  const setActiveImage = (index: number) => setImageChoice({ variantId: activeVariantId, index });

  const endsAt = product.price.flashSaleEndsAt ?? product.price.offerEndsAt;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-tm-lg)] border border-line bg-white">
          {images[activeImage] ? (
            <Image
              src={images[activeImage]}
              alt={product.images[activeImage]?.alt ?? product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-brand-400">No image available</div>
          )}
          {badge ? <span className="discount-pill">{badge}</span> : null}
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((url, index) => (
              <button
                key={url}
                type="button"
                onClick={() => setActiveImage(index)}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-tm)] border-2 bg-white",
                  index === activeImage ? "border-brand-900" : "border-line hover:border-brand-300",
                )}
                aria-label={`View image ${index + 1}`}
              >
                <Image src={url} alt="" fill sizes="64px" className="object-contain" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Purchase panel */}
      <div className="stack">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-brand-500">
            {sku ? <span className="mono">SKU: {sku}</span> : null}
            {product.brand ? <span>Brand: <strong className="text-brand-800">{product.brand.name}</strong></span> : null}
            {product.soldCount > 0 ? <span>{product.soldCount} sold</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Price amount={unitPrice} compareAt={compareAt ?? (listPrice > unitPrice ? listPrice : null)} size="lg" />
          {listPrice > unitPrice ? (
            <span className="badge-red">Save {formatMoney(listPrice - unitPrice)}</span>
          ) : null}
        </div>

        {endsAt && product.price.showCountdown ? (
          <div className="panel flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-brand-800">
              {product.price.offerTitle ?? "Limited time offer"}
            </span>
            <Countdown endsAt={endsAt.toString()} label="Ends in" />
          </div>
        ) : null}

        {product.shortDescription ? (
          <p className="text-sm leading-relaxed text-brand-600">{product.shortDescription}</p>
        ) : null}

        {/* Variant attributes */}
        {product.attributes.map((attribute) => (
          <fieldset key={attribute.id} className="field">
            <legend className="label mb-1.5">
              {attribute.name}
              {attribute.unit ? ` (${attribute.unit})` : ""}
              {selected[attribute.id] ? (
                <span className="ml-1 font-normal text-brand-500">
                  — {attribute.options.find((option) => option.id === selected[attribute.id])?.label}
                </span>
              ) : null}
            </legend>
            <div className="flex flex-wrap gap-2">
              {attribute.options.map((option) => {
                const isSelected = selected[attribute.id] === option.id;
                const isReachable = reachableOptionIds.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!isReachable && !isSelected}
                    onClick={() =>
                      setSelected((current) =>
                        current[attribute.id] === option.id
                          ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== attribute.id))
                          : { ...current, [attribute.id]: option.id },
                      )
                    }
                    className={cn(
                      "variant-option",
                      isSelected && "variant-option-active",
                      !isReachable && !isSelected && "variant-option-disabled",
                    )}
                    aria-pressed={isSelected}
                  >
                    {attribute.type === "COLOR" && option.colorHex ? (
                      <span
                        className="mr-1.5 inline-block h-3 w-3 rounded-full border border-line align-middle"
                        style={{ backgroundColor: option.colorHex }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="text-sm">
          {stock <= 0 ? (
            <p className="stock-out">Out of stock</p>
          ) : stock <= product.lowStockThreshold ? (
            <p className="stock-low">Hurry — only {stock} left</p>
          ) : (
            <p className="stock-in">In stock</p>
          )}
        </div>

        <AddToCartForm
          productId={product.id}
          variantId={activeVariant?.id ?? null}
          maxQuantity={stock}
          disabled={needsSelection || stock <= 0}
          disabledReason={needsSelection ? "Choose every option to continue." : undefined}
          showBuyNow
        />

        <div className="panel space-y-1.5 text-xs text-brand-600">
          {product.shippingMode === "FREE" ? (
            <p className="font-semibold text-success-600">✓ Free delivery on this product</p>
          ) : product.shippingMode === "FIXED" && product.shippingFlatFee ? (
            <p>Delivery charge for this product: <strong>{formatMoney(product.shippingFlatFee)}</strong></p>
          ) : (
            <p>Delivery charge is calculated from your district at checkout.</p>
          )}
          <p>Cash on delivery available. Check the returns policy before ordering.</p>
        </div>
      </div>
    </div>
  );
}
