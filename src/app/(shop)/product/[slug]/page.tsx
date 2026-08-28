import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { Breadcrumb, JsonLd, Rating, SectionHeading } from "@/components/ui";
import { ProductGrid } from "@/components/site/product-card";
import { ProductPurchasePanel } from "@/components/site/product-detail-client";
import { getProductDetail, getProductReviews, getRelatedProducts, incrementProductView } from "@/lib/services/products";
import { getSettings } from "@/lib/settings";
import { breadcrumbJsonLd, buildMetadata, productJsonLd } from "@/lib/seo";
import { formatDate, stripHtml } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductDetail(slug), getSettings()]);
  if (!product) return { title: "Product not found" };

  return buildMetadata(settings.seo, {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? stripHtml(product.description ?? ""),
    path: `/product/${product.slug}`,
    canonical: product.canonicalUrl ?? `/product/${product.slug}`,
    image: product.ogImageUrl ?? product.images[0]?.url ?? null,
    noIndex: product.noIndex,
    type: "product",
  });
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const [related, reviews, settings] = await Promise.all([
    getRelatedProducts(product.id, product.category?.id ?? null, 8),
    getProductReviews(product.id, 8),
    getSettings(),
  ]);

  // Fire-and-forget; a counter must never delay the page.
  void incrementProductView(product.id);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    ...(product.category?.parent ? [{ name: product.category.parent.name, path: `/category/${product.category.parent.slug}` }] : []),
    ...(product.category ? [{ name: product.category.name, path: `/category/${product.category.slug}` }] : []),
    { name: product.name, path: `/product/${product.slug}` },
  ];

  return (
    <div className="tm-container section">
      <Breadcrumb items={crumbs.map((crumb, index) => ({
        label: crumb.name,
        href: index < crumbs.length - 1 ? crumb.path : undefined,
      }))} />

      <div className="mt-5">
        <ProductPurchasePanel product={product} />
      </div>

      {/* Description, specifications and shipping */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 stack">
          {product.description ? (
            <section className="card">
              <div className="card-header"><h2 className="card-title">Description</h2></div>
              <div className="card-body cms-content whitespace-pre-line">{product.description}</div>
            </section>
          ) : null}

          {product.specifications.length > 0 ? (
            <section className="card">
              <div className="card-header"><h2 className="card-title">Specifications</h2></div>
              <div className="table-wrap border-0">
                <table className="table table-compact min-w-0">
                  <tbody>
                    {product.specifications.map((spec) => (
                      <tr key={spec.label}>
                        <th scope="row" className="w-40 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-brand-500">
                          {spec.label}
                        </th>
                        <td>{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Reviews */}
          {settings.features.reviewsEnabled ? (
            <section className="card" id="reviews">
              <div className="card-header">
                <h2 className="card-title">Customer reviews</h2>
                <Rating value={product.ratingAverage} count={product.ratingCount} />
              </div>
              <div className="card-body stack">
                {reviews.length === 0 ? (
                  <p className="muted">
                    No reviews yet. Reviews can only be written by customers who received this product.
                  </p>
                ) : (
                  reviews.map((review) => (
                    <article key={review.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                      <div className="row-between flex-wrap">
                        <div className="flex items-center gap-2">
                          <Rating value={review.rating} showCount={false} />
                          <span className="text-sm font-semibold">{review.user?.name ?? review.authorName ?? "Customer"}</span>
                          {review.isVerifiedPurchase ? <span className="badge-green">Verified purchase</span> : null}
                        </div>
                        <span className="muted-xs">{formatDate(review.createdAt)}</span>
                      </div>
                      {review.title ? <p className="mt-2 text-sm font-semibold">{review.title}</p> : null}
                      {review.body ? <p className="mt-1 text-sm leading-relaxed text-brand-600">{review.body}</p> : null}
                      {review.reply ? (
                        <div className="mt-3 rounded-[var(--radius-tm)] bg-surface-muted p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-brand-500">Trust Mart replied</p>
                          <p className="mt-1 text-sm text-brand-700">{review.reply}</p>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Shipping & returns</h2></div>
            <div className="card-body space-y-2 text-sm text-brand-600">
              <p>{settings.shipping.note}</p>
              <p>
                <Link href="/shipping" className="link">Shipping & delivery</Link> ·{" "}
                <Link href="/returns" className="link">Returns</Link> ·{" "}
                <Link href="/refund-policy" className="link">Refund policy</Link>
              </p>
            </div>
          </section>

          {product.tags.length > 0 ? (
            <section className="card">
              <div className="card-header"><h2 className="card-title">Tags</h2></div>
              <div className="card-body flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="chip">{tag}</Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-header"><h2 className="card-title">Need help?</h2></div>
            <div className="card-body space-y-2 text-sm text-brand-600">
              <p>Call us on <a className="link" href={`tel:${settings.contact.phone}`}>{settings.contact.phone}</a></p>
              <p>{settings.contact.workingHours}</p>
              <Link href="/contact" className="btn-secondary btn-sm btn-block">Contact support</Link>
            </div>
          </section>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="mt-12">
          <SectionHeading title="You may also like" />
          <ProductGrid products={related} />
        </section>
      ) : null}

      <JsonLd
        data={[
          productJsonLd({
            name: product.name,
            slug: product.slug,
            description: product.shortDescription ?? product.description,
            image: product.images[0]?.url ?? null,
            sku: product.sku,
            brand: product.brand?.name ?? null,
            price: product.price.unitPrice,
            currency: "BDT",
            inStock: product.stock > 0 || product.variants.some((variant) => variant.stock > 0),
            ratingAverage: product.ratingAverage,
            ratingCount: product.ratingCount,
          }),
          breadcrumbJsonLd(crumbs),
        ]}
      />
    </div>
  );
}
