import "server-only";

import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";
import { PAGE_SIZES } from "@/lib/constants";

/**
 * Reads for the public blog.
 *
 * Every query here filters on `status: "PUBLISHED"` and a `publishedAt` in the
 * past. Both matter: an article scheduled for next Tuesday is PUBLISHED in the
 * editor's mind and in the database, and it must still not appear on the site
 * until Tuesday. The dashboard reads go through `prisma` directly, because
 * there the whole point is to see drafts.
 */

export type BlogCardPost = {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  authorName: string | null;
  category: { slug: string; name: string } | null;
};

const CARD_SELECT = {
  slug: true,
  title: true,
  subtitle: true,
  excerpt: true,
  coverImageUrl: true,
  coverImageAlt: true,
  publishedAt: true,
  readingMinutes: true,
  authorName: true,
  category: { select: { slug: true, name: true } },
} as const;

/** The one condition that decides whether the public may see an article. */
function livePosts() {
  return { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };
}

export async function listPublishedPosts(options: {
  page?: number;
  perPage?: number;
  categorySlug?: string | null;
  tag?: string | null;
  query?: string | null;
} = {}): Promise<{ posts: BlogCardPost[]; total: number; page: number; perPage: number }> {
  const perPage = options.perPage ?? PAGE_SIZES.storefront;
  const page = Math.max(1, options.page ?? 1);

  const where = {
    ...livePosts(),
    ...(options.categorySlug ? { category: { slug: options.categorySlug } } : {}),
    ...(options.tag ? { tags: { has: options.tag } } : {}),
    ...(options.query
      ? {
          OR: [
            { title: { contains: options.query, mode: "insensitive" as const } },
            { excerpt: { contains: options.query, mode: "insensitive" as const } },
            { subtitle: { contains: options.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [posts, total] = await Promise.all([
    safeQuery(
      () =>
        prisma.blogPost.findMany({
          where,
          select: CARD_SELECT,
          orderBy: [{ publishedAt: "desc" }],
          skip: (page - 1) * perPage,
          take: perPage,
        }),
      [],
      "listPublishedPosts",
    ),
    safeQuery(() => prisma.blogPost.count({ where }), 0, "countPublishedPosts"),
  ]);

  return { posts, total, page, perPage };
}

/** The newest article, given its own treatment at the top of the listing. */
export async function getFeaturedPost(): Promise<BlogCardPost | null> {
  return safeQuery(
    () =>
      prisma.blogPost.findFirst({
        where: { ...livePosts(), isFeatured: true },
        select: CARD_SELECT,
        orderBy: { publishedAt: "desc" },
      }),
    null,
    "getFeaturedPost",
  );
}

export const getPostBySlug = cache(async (slug: string) =>
  safeQuery(
    () =>
      prisma.blogPost.findFirst({
        where: { slug, ...livePosts() },
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          excerpt: true,
          content: true,
          coverImageUrl: true,
          coverImageAlt: true,
          publishedAt: true,
          updatedAt: true,
          readingMinutes: true,
          viewCount: true,
          tags: true,
          seoTitle: true,
          seoDescription: true,
          ogImageUrl: true,
          canonicalUrl: true,
          noIndex: true,
          authorName: true,
          category: { select: { slug: true, name: true } },
          images: {
            select: { id: true, url: true, alt: true, caption: true },
            orderBy: { position: "asc" },
          },
        },
      }),
    null,
    "getPostBySlug",
  ),
);

/**
 * Same category first, then anything recent, never the article itself. Asking
 * for one more than needed and trimming keeps it to a single query.
 */
export async function getRelatedPosts(post: {
  slug: string;
  category: { slug: string } | null;
}): Promise<BlogCardPost[]> {
  const related = await safeQuery(
    () =>
      prisma.blogPost.findMany({
        where: { ...livePosts(), NOT: { slug: post.slug } },
        select: CARD_SELECT,
        orderBy: { publishedAt: "desc" },
        take: 12,
      }),
    [],
    "getRelatedPosts",
  );

  const sameCategory = post.category
    ? related.filter((item) => item.category?.slug === post.category?.slug)
    : [];
  const rest = related.filter((item) => !sameCategory.includes(item));
  return [...sameCategory, ...rest].slice(0, 3);
}

export async function listBlogCategories() {
  return safeQuery(
    () =>
      prisma.blogCategory.findMany({
        where: { isActive: true },
        select: {
          slug: true,
          name: true,
          description: true,
          _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
        },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      }),
    [],
    "listBlogCategories",
  );
}

/**
 * Fire-and-forget view count.
 *
 * An `update` that throws must not take the article page down with it, so the
 * failure is swallowed — a lost view is worth less than a 500.
 */
export async function recordPostView(id: string): Promise<void> {
  await safeQuery(
    () => prisma.blogPost.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
    null,
    "recordPostView",
  );
}

/** Slugs for the sitemap and the RSS feed. */
export async function listPublishedSlugs(take = 2000) {
  return safeQuery(
    () =>
      prisma.blogPost.findMany({
        where: { ...livePosts(), noIndex: false },
        select: { slug: true, title: true, excerpt: true, publishedAt: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
        take,
      }),
    [],
    "listPublishedSlugs",
  );
}
