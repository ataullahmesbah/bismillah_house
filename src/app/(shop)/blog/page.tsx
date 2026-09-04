import type { Metadata } from "next";
import Link from "next/link";

import { BlogCard, BlogFeature } from "@/components/site/blog-card";
import { Breadcrumb, EmptyState, JsonLd, Pagination } from "@/components/ui";
import { getFeaturedPost, listBlogCategories, listPublishedPosts } from "@/lib/services/blog";
import { getSettings } from "@/lib/settings";
import { blogJsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { buildQuery, cn, parsePositiveInt } from "@/lib/utils";

/*
 * Per-request, like every other page inside the shop layout: that header reads
 * cookies for the signed-in customer and the cart, which makes the whole tree
 * dynamic. See the note in `(shop)/[slug]/page.tsx`.
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [settings, params, categories] = await Promise.all([
    getSettings(),
    searchParams,
    listBlogCategories(),
  ]);
  const slug = typeof params.category === "string" ? params.category : null;
  const page = parsePositiveInt(typeof params.page === "string" ? params.page : undefined, 1, 1000);
  // The slug, not the name, is what is in the URL — resolving it here is what
  // keeps the title reading "Kitchen notes articles" and not "kitchen-notes".
  const category = slug ? categories.find((item) => item.slug === slug) ?? null : null;

  return buildMetadata(settings.seo, {
    title: category ? `${category.name} — ${settings.seo.organizationName} blog` : `Blog — ${settings.seo.organizationName}`,
    description:
      category?.description ??
      "Guides, product notes and shopping advice from the team, written for customers in Bangladesh.",
    path: "/blog",
    /*
     * Filters and page 2 onwards canonicalise back to /blog. They are real,
     * useful URLs but they are the same articles resliced, and letting each
     * one claim its own canonical is how a small blog ends up competing
     * against itself for the same query.
     */
    canonical: "/blog",
    noIndex: page > 1,
    type: "website",
  });
}

export default async function BlogIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const categorySlug = single("category") ?? null;
  const tag = single("tag") ?? null;
  const q = single("q")?.trim() || null;
  const page = parsePositiveInt(single("page"), 1, 1000);

  const [settings, categories, { posts, total, perPage }, featured] = await Promise.all([
    getSettings(),
    listBlogCategories(),
    listPublishedPosts({ page, categorySlug, tag, query: q }),
    // The lead card only makes sense on the unfiltered first page — on a
    // filtered view it would show an article that is not in the filter.
    !categorySlug && !tag && !q && page === 1 ? getFeaturedPost() : Promise.resolve(null),
  ]);

  // Never show the featured article twice.
  const rest = featured ? posts.filter((post) => post.slug !== featured.slug) : posts;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const activeCategory = categories.find((category) => category.slug === categorySlug) ?? null;
  const filterHref = (next: Record<string, string | number | undefined>) =>
    `/blog${buildQuery({ category: categorySlug ?? undefined, tag: tag ?? undefined, q: q ?? undefined, ...next })}`;

  return (
    <div className="tm-container section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />

      <header className="section-head mt-4">
        <h1 className="section-title">{activeCategory?.name ?? "Blog"}</h1>
        <p className="section-subtitle">
          {activeCategory?.description ??
            "Guides, product notes and shopping advice from the Trust Mart team."}
        </p>
      </header>

      {categories.length > 0 ? (
        <nav className="scroll-x -mx-1 mb-6 flex gap-2 px-1 pb-1" aria-label="Article categories">
          <Link href={filterHref({ category: undefined, page: undefined })} className={cn("article-tag", !categorySlug && "border-brand-900 text-brand-950")}>
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/blog${buildQuery({ category: category.slug, q: q ?? undefined })}`}
              className={cn("article-tag whitespace-nowrap", categorySlug === category.slug && "border-brand-900 text-brand-950")}
            >
              {category.name} ({category._count.posts})
            </Link>
          ))}
        </nav>
      ) : null}

      {tag || q ? (
        <p className="mb-6 text-sm text-brand-600">
          {tag ? <>Tagged <strong>{tag}</strong>. </> : null}
          {q ? <>Matching <strong>{q}</strong>. </> : null}
          <Link href="/blog" className="link">Clear</Link>
        </p>
      ) : null}

      {featured ? (
        <div className="mb-8">
          <BlogFeature post={featured} />
        </div>
      ) : null}

      {rest.length === 0 && !featured ? (
        <EmptyState
          title="Nothing published yet"
          description="New articles will appear here."
          action={<Link href="/shop" className="btn-primary btn-sm">Browse the shop</Link>}
        />
      ) : (
        <div className="blog-grid">
          {rest.map((post, index) => (
            /*
             * Exactly one lead image per page. When there is a feature card it
             * owns that slot; otherwise the first card does. Marking a whole
             * row high-priority would just make three images compete for the
             * same bandwidth and delay all of them.
             */
            <BlogCard key={post.slug} post={post} lead={!featured && index === 0} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={(next) => filterHref({ page: next > 1 ? next : undefined })} />

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])} />
      {posts.length > 0 ? <JsonLd data={blogJsonLd(settings.seo, posts)} /> : null}
    </div>
  );
}
