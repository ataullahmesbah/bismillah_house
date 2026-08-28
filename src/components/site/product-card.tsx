import Image from "next/image";
import Link from "next/link";

import { Price, Rating } from "@/components/ui";
import { discountPercent } from "@/lib/money";
import type { ProductCardModel } from "@/lib/services/catalog";
import { QuickAddButton } from "./add-to-cart";
import { Countdown } from "./countdown";

export function ProductCard({ product, showQuickAdd = true }: { product: ProductCardModel; showQuickAdd?: boolean }) {
  const percent = discountPercent(product.compareAtPrice ?? product.listPrice, product.unitPrice);

  return (
    <article className="product-card group">
      {percent ? <span className="discount-pill">-{percent}%</span> : null}

      <Link href={`/product/${product.slug}`} className="product-media" aria-label={product.name}>
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            width={600}
            height={600}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-brand-400">No image</div>
        )}
      </Link>

      <div className="product-body">
        {product.categoryName ? <p className="muted-xs clamp-1">{product.categoryName}</p> : null}

        <Link href={`/product/${product.slug}`}>
          <h3 className="product-title">{product.name}</h3>
        </Link>

        {product.ratingCount > 0 ? <Rating value={product.rating} count={product.ratingCount} /> : null}

        <div className="mt-auto space-y-2 pt-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Price amount={product.unitPrice} compareAt={product.compareAtPrice ?? product.listPrice} />
            {product.badge ? <span className="badge-red">{product.badge}</span> : null}
          </div>

          {product.shippingMode === "FREE" ? (
            <p className="text-xs font-semibold text-success-600">Free delivery</p>
          ) : null}

          {product.flashEndsAt ? (
            <Countdown endsAt={product.flashEndsAt} compact label="Ends in" />
          ) : null}

          {!product.inStock ? (
            <p className="stock-out">Out of stock</p>
          ) : product.stock <= 5 ? (
            <p className="stock-low">Only {product.stock} left</p>
          ) : null}

          {showQuickAdd ? (
            <QuickAddButton
              productId={product.id}
              inStock={product.inStock}
              hasVariants={product.hasVariants}
              slug={product.slug}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardModel[] }) {
  return (
    <div className="grid-products">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
