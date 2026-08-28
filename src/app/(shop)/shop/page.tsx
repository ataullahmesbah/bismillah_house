import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumb, EmptyState, JsonLd, Pagination, Skeleton } from "@/components/ui";
import { ProductGrid } from "@/components/site/product-card";
import { ProductFilters } from "@/components/site/product-filters";
import { searchProducts, type ProductSort } from "@/lib/services/products";
import { getSettings } from "@/lib/settings";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { toMinor } from "@/lib/money";
import { buildQuery, parsePositiveInt } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const settings = await getSettings();
  const params = await searchParams;
  // Filtered and paginated listings canonicalise back to /shop so search
  // engines never index thousands of near-duplicate URLs (PRD §24).
  const isFiltered = Object.keys(params).some((key) => key !== "page");
  return buildMetadata(settings.seo, {
    title: "Shop all products",
    description: `Browse every product available at ${settings.site.siteName}.`,
    path: "/shop",
    canonical: "/shop",
    noIndex: isFiltered,
  });
}

function readParams(params: Record<string, string | string[] | undefined>) {
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return {
    q: single("q")?.trim() || undefined,
    categorySlug: single("category") || undefined,
    brandSlug: single("brand") || undefined,
    minPrice: single("min") ? toMinor(Number(single("min"))) : undefined,
    maxPrice: single("max") ? toMinor(Number(single("max"))) : undefined,
    inStockOnly: single("stock") === "1",
    onSaleOnly: single("sale") === "1",
    sort: (single("sort") as ProductSort | undefined) ?? "newest",
    page: parsePositiveInt(single("page"), 1, 10000),
  };
}

async function ShopResults({ params }: { params: Record<string, string | string[] | undefined> }) {
  const query = readParams(params);
  const result = await searchProducts(query);

  const buildHref = (page: number) =>
    `/shop${buildQuery({
      q: query.q,
      category: query.categorySlug,
      brand: query.brandSlug,
      min: params.min as string | undefined,
      max: params.max as string | undefined,
      stock: query.inStockOnly ? "1" : undefined,
      sale: query.onSaleOnly ? "1" : undefined,
      sort: query.sort,
      page: page > 1 ? page : undefined,
    })}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <ProductFilters facets={result.facets} />

      <div>
        <div className="row-between mb-4 flex-wrap">
          <p className="muted">
            {result.total === 0
              ? "No products found"
              : `Showing ${(result.page - 1) * result.perPage + 1}–${Math.min(result.page * result.perPage, result.total)} of ${result.total} products`}
          </p>
        </div>

        {result.products.length === 0 ? (
          <EmptyState
            title="No products match your filters"
            description="Try widening your price range or clearing a filter."
          />
        ) : (
          <>
            <ProductGrid products={result.products} />
            <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
          </>
        )}
      </div>
    </div>
  );
}

function ShopSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <Skeleton className="h-96" />
      <div className="grid-products">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-72" />
        ))}
      </div>
    </div>
  );
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <div className="tm-container section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
      <h1 className="page-title mt-3 mb-6">All products</h1>

      <Suspense fallback={<ShopSkeleton />}>
        <ShopResults params={params} />
      </Suspense>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }])} />
    </div>
  );
}
