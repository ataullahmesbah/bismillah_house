import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb, EmptyState, JsonLd, Pagination } from "@/components/ui";
import { ProductGrid } from "@/components/site/product-card";
import { ProductFilters } from "@/components/site/product-filters";
import { prisma } from "@/lib/db";
import { searchProducts, type ProductSort } from "@/lib/services/products";
import { getBanners } from "@/lib/services/navigation";
import { getSettings } from "@/lib/settings";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { toMinor } from "@/lib/money";
import { buildQuery, parsePositiveInt } from "@/lib/utils";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadCategory(slug: string) {
  return prisma.category.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: {
      id: true, name: true, slug: true, description: true, bannerUrl: true,
      seoTitle: true, seoDescription: true,
      parent: { select: { name: true, slug: true } },
      children: {
        where: { isActive: true, deletedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, name: true, slug: true, imageUrl: true },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [category, settings] = await Promise.all([loadCategory(slug), getSettings()]);
  if (!category) return { title: "Category not found" };

  return buildMetadata(settings.seo, {
    title: category.seoTitle ?? `${category.name} — buy online`,
    description: category.seoDescription ?? category.description ?? `Shop ${category.name} at ${settings.site.siteName}.`,
    path: `/category/${category.slug}`,
    canonical: `/category/${category.slug}`,
  });
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const category = await loadCategory(slug);
  if (!category) notFound();

  const single = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = parsePositiveInt(single("page"), 1, 10000);

  const [result, banners] = await Promise.all([
    searchProducts({
      categorySlug: slug,
      brandSlug: single("brand") || undefined,
      minPrice: single("min") ? toMinor(Number(single("min"))) : undefined,
      maxPrice: single("max") ? toMinor(Number(single("max"))) : undefined,
      inStockOnly: single("stock") === "1",
      onSaleOnly: single("sale") === "1",
      sort: (single("sort") as ProductSort | undefined) ?? "newest",
      page,
    }),
    getBanners("CATEGORY_TOP", 1),
  ]);

  const banner = banners[0];
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    ...(category.parent ? [{ name: category.parent.name, path: `/category/${category.parent.slug}` }] : []),
    { name: category.name, path: `/category/${category.slug}` },
  ];

  const buildHref = (nextPage: number) =>
    `/category/${slug}${buildQuery({ sort: single("sort"), page: nextPage > 1 ? nextPage : undefined })}`;

  return (
    <div className="tm-container section">
      <Breadcrumb items={crumbs.map((crumb, index) => ({
        label: crumb.name,
        href: index < crumbs.length - 1 ? crumb.path : undefined,
      }))} />

      {category.bannerUrl || banner?.imageUrl ? (
        <div className="relative mt-4 aspect-[4/1] w-full overflow-hidden rounded-[var(--radius-tm-lg)] bg-surface-sunken">
          <Image
            src={(category.bannerUrl ?? banner?.imageUrl) as string}
            alt={category.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      <div className="mt-5 mb-6">
        <h1 className="page-title">{category.name}</h1>
        {category.description ? <p className="page-desc max-w-3xl">{category.description}</p> : null}
      </div>

      {category.children.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link key={child.id} href={`/category/${child.slug}`} className="chip">{child.name}</Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ProductFilters facets={result.facets} lockedCategory={slug} />
        <div>
          <p className="muted mb-4">{result.total} product{result.total === 1 ? "" : "s"}</p>
          {result.products.length === 0 ? (
            <EmptyState
              title="No products in this category yet"
              description="Check back soon, or browse the full catalogue."
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

      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </div>
  );
}
