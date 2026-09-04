"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { fromMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

export type FilterFacets = {
  categories: Array<{ id: string; name: string; slug: string; count: number }>;
  brands: Array<{ id: string; name: string; slug: string; count: number }>;
  priceRange: { min: number; max: number };
};

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "popular", label: "Most popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "featured", label: "Featured" },
];

/** Client-side filter panel that only ever changes the URL — the query runs on the server. */
export function ProductFilters({ facets, lockedCategory }: { facets: FilterFacets; lockedCategory?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [minPrice, setMinPrice] = useState(params.get("min") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("max") ?? "");

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const activeCategory = params.get("category");
  const activeBrand = params.get("brand");
  const hasFilters = Boolean(activeCategory || activeBrand || params.get("min") || params.get("max") || params.get("stock") || params.get("sale"));

  return (
    <aside className="stack" aria-label="Product filters">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Filters</h2>
          {hasFilters ? (
            <Link href={pathname} className="btn-link text-xs">Clear all</Link>
          ) : null}
        </div>

        <div className="card-body stack">
          <div className="field">
            {/* A real <label htmlFor>, not a span: without the association the
                select has no accessible name at all. */}
            <label className="label" htmlFor="sort">Sort by</label>
            <select
              id="sort"
              className="select"
              value={params.get("sort") ?? "newest"}
              onChange={(event) => apply({ sort: event.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">Price range (৳)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                className="input"
                placeholder={String(fromMinor(facets.priceRange.min))}
                value={minPrice}
                min={0}
                onChange={(event) => setMinPrice(event.target.value)}
                aria-label="Minimum price"
              />
              <span className="text-brand-400">–</span>
              <input
                type="number"
                inputMode="numeric"
                className="input"
                placeholder={String(fromMinor(facets.priceRange.max))}
                value={maxPrice}
                min={0}
                onChange={(event) => setMaxPrice(event.target.value)}
                aria-label="Maximum price"
              />
            </div>
            <button
              type="button"
              className="btn-secondary btn-sm mt-2"
              onClick={() => apply({ min: minPrice || null, max: maxPrice || null })}
            >
              Apply price
            </button>
          </div>

          <div className="stack gap-2">
            <label className="check-row">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={params.get("stock") === "1"}
                onChange={(event) => apply({ stock: event.target.checked ? "1" : null })}
              />
              <span>In stock only</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={params.get("sale") === "1"}
                onChange={(event) => apply({ sale: event.target.checked ? "1" : null })}
              />
              <span>On sale</span>
            </label>
          </div>
        </div>
      </div>

      {!lockedCategory && facets.categories.length > 0 ? (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Categories</h2></div>
          <div className="card-body max-h-72 overflow-y-auto p-2">
            {facets.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => apply({ category: activeCategory === category.slug ? null : category.slug })}
                className={cn("sidebar-link w-full justify-between", activeCategory === category.slug && "sidebar-link-active")}
              >
                <span className="truncate">{category.name}</span>
                <span className="muted-xs shrink-0">{category.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {facets.brands.length > 0 ? (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Brands</h2></div>
          <div className="card-body max-h-64 overflow-y-auto p-2">
            {facets.brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => apply({ brand: activeBrand === brand.slug ? null : brand.slug })}
                className={cn("sidebar-link w-full justify-between", activeBrand === brand.slug && "sidebar-link-active")}
              >
                <span className="truncate">{brand.name}</span>
                <span className="muted-xs shrink-0">{brand.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
