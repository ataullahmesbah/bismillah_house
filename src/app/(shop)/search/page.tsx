import Link from "next/link";
import type { Metadata } from "next";

import { Breadcrumb, EmptyState, Pagination } from "@/components/ui";
import { ProductGrid } from "@/components/site/product-card";
import { ProductFilters } from "@/components/site/product-filters";
import { searchProducts, type ProductSort } from "@/lib/services/products";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { buildQuery, parsePositiveInt } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const settings = await getSettings();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  return buildMetadata(settings.seo, {
    title: query ? `Search results for “${query}”` : "Search",
    description: `Search products at ${settings.site.siteName}.`,
    path: "/search",
    canonical: "/search",
    // Search result pages are useful to people, not to a search index.
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const query = single("q")?.trim() ?? "";
  const page = parsePositiveInt(single("page"), 1, 10000);

  const result = await searchProducts({
    q: query || undefined,
    categorySlug: single("category") || undefined,
    brandSlug: single("brand") || undefined,
    inStockOnly: single("stock") === "1",
    onSaleOnly: single("sale") === "1",
    sort: (single("sort") as ProductSort | undefined) ?? "relevance",
    page,
  });

  const buildHref = (nextPage: number) =>
    `/search${buildQuery({ q: query, sort: single("sort"), page: nextPage > 1 ? nextPage : undefined })}`;

  return (
    <div className="tm-container section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      <h1 className="page-title mt-3">
        {query ? <>Results for “{query}”</> : "Search products"}
      </h1>
      <p className="page-desc mb-6">{result.total} product{result.total === 1 ? "" : "s"} found</p>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ProductFilters facets={result.facets} />
        <div>
          {result.products.length === 0 ? (
            <EmptyState
              title="Nothing matched your search"
              description="Check the spelling, try a shorter phrase, or browse the full catalogue."
              action={<Link href="/shop" className="btn-primary">Browse all products</Link>}
            />
          ) : (
            <>
              <ProductGrid products={result.products} />
              <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
