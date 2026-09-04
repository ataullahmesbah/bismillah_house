import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogCard } from "@/components/site/blog-card";
import { Breadcrumb, JsonLd } from "@/components/ui";
import { getPostBySlug, getRelatedPosts, recordPostView } from "@/lib/services/blog";
import { getSettings } from "@/lib/settings";
import { articleJsonLd, breadcrumbJsonLd, buildMetadata, faqJsonLd } from "@/lib/seo";
import { extractQuestions, htmlToText, sanitizeRichText } from "@/lib/sanitize";
import { formatDate, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

/** The meta description, in the order the editor would expect it to be taken. */
function describe(post: {
  seoDescription: string | null;
  excerpt: string | null;
  subtitle: string | null;
  content: string;
}): string {
  return (
    post.seoDescription ??
    post.excerpt ??
    post.subtitle ??
    truncate(htmlToText(post.content), 200)
  );
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getPostBySlug(slug), getSettings()]);
  if (!post) {
    // A missing resource streams as HTTP 200, so this metadata is what a
    // crawler acts on. Without an explicit noindex it inherits the site
    // default of "index, follow" and the soft 404 gets indexed.
    return { title: "Article not found", robots: { index: false, follow: false } };
  }

  return buildMetadata(settings.seo, {
    title: post.seoTitle ?? post.title,
    description: describe(post),
    path: `/blog/${post.slug}`,
    image: post.ogImageUrl ?? post.coverImageUrl,
    canonical: post.canonicalUrl ?? `/blog/${post.slug}`,
    noIndex: post.noIndex,
    type: "article",
  });
}

export default async function BlogArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getPostBySlug(slug), getSettings()]);
  if (!post) notFound();

  const related = await getRelatedPosts(post);

  /*
   * Sanitised again on the way out. The save action already cleaned this, so
   * for anything written since then it is a no-op — but rows that predate the
   * sanitiser, or that some future code path writes without going through the
   * action, must not be the one thing standing between a stored `<script>` and
   * every reader.
   */
  const content = sanitizeRichText(post.content);
  const plain = htmlToText(content);

  /*
   * AEO: sections the author headed with a question become FAQ markup, which
   * is what makes them eligible for "People also ask" and quotable by an
   * answer engine. Derived from the article rather than a second set of form
   * fields nobody would fill in.
   */
  const questions = extractQuestions(content);

  // Deliberately not awaited: a view count is not worth delaying the page for,
  // and `recordPostView` swallows its own failures.
  void recordPostView(post.id);

  return (
    <div className="tm-container section">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          ...(post.category ? [{ label: post.category.name, href: `/blog?category=${post.category.slug}` }] : []),
          { label: post.title },
        ]}
      />

      <article className="mt-6">
        <header className="article-body text-center">
          {post.category ? (
            <Link href={`/blog?category=${post.category.slug}`} className="blog-kicker mx-auto">
              {post.category.name}
            </Link>
          ) : null}
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-brand-950 sm:text-4xl">
            {post.title}
          </h1>
          {post.subtitle ? (
            <p className="mt-3 text-lg leading-relaxed text-brand-600">{post.subtitle}</p>
          ) : null}
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-brand-500">
            {post.authorName ? <span>By {post.authorName}</span> : null}
            {post.authorName && post.publishedAt ? <span aria-hidden="true">·</span> : null}
            {post.publishedAt ? (
              <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>{post.readingMinutes} min read</span>
          </p>
        </header>

        {post.coverImageUrl ? (
          <figure className="relative mx-auto mt-8 aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-[var(--radius-tm-lg)] bg-surface-sunken">
            <Image
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? ""}
              fill
              sizes="(max-width: 1024px) 100vw, 896px"
              className="object-cover"
              // The cover is the largest element above the fold, so it is the
              // Largest Contentful Paint on this page. Loading it eagerly is
              // the single biggest thing that moves that number.
              preload
              fetchPriority="high"
            />
          </figure>
        ) : null}

        <div
          className="cms-content article-body mt-8"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {post.images.length > 0 ? (
          <section className="article-body mt-10">
            <h2 className="text-lg font-bold text-brand-950">Gallery</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {post.images.map((image) => (
                <figure key={image.id}>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-tm)] bg-surface-sunken">
                    <Image
                      src={image.url}
                      alt={image.alt ?? ""}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                  {image.caption ? (
                    <figcaption className="mt-2 text-xs text-brand-500">{image.caption}</figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {post.tags.length > 0 ? (
          <div className="article-body mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="article-tag">
                #{tag}
              </Link>
            ))}
          </div>
        ) : null}
      </article>

      {related.length > 0 ? (
        <section className="section-tight mt-12 border-t border-line pt-10">
          <h2 className="section-title text-xl">Keep reading</h2>
          <div className="blog-grid mt-5">
            {related.map((item) => (
              <BlogCard key={item.slug} post={item} />
            ))}
          </div>
        </section>
      ) : null}

      <JsonLd
        data={articleJsonLd(settings.seo, {
          title: post.title,
          description: describe(post),
          slug: post.slug,
          image: post.ogImageUrl ?? post.coverImageUrl,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          authorName: post.authorName,
          section: post.category?.name ?? null,
          tags: post.tags,
          wordCount: plain.split(/\s+/).filter(Boolean).length,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      {questions.length > 0 ? <JsonLd data={faqJsonLd(questions)} /> : null}
    </div>
  );
}
