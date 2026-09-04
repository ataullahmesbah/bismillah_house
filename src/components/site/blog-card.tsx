import Image from "next/image";
import Link from "next/link";

import type { BlogCardPost } from "@/lib/services/blog";
import { formatDate } from "@/lib/utils";

/**
 * The card's 16:9 image slot.
 *
 * With no cover picture the slot still needs filling or the card collapses —
 * the first letter of the title on a soft gradient reads as a deliberate
 * placeholder rather than a broken image.
 *
 * `lead` marks the one image on the page that is the Largest Contentful Paint.
 * Next 16 deprecated `priority`, which now only inserts a preload link: that
 * makes the image *discoverable* early but leaves it queued at default
 * priority, which is what Lighthouse reports as "fetchpriority should be
 * applied to the image preload request". `preload` plus an explicit
 * `fetchPriority="high"` gives both — found early, and fetched first.
 */
function Cover({ post, sizes, lead }: { post: BlogCardPost; sizes: string; lead?: boolean }) {
  if (!post.coverImageUrl) {
    return <span className="blog-media-empty absolute inset-0" aria-hidden="true">{post.title.charAt(0)}</span>;
  }
  return (
    <Image
      src={post.coverImageUrl}
      // An empty alt is correct here: the title sits right beneath the image as
      // real text, so describing it again would just be read out twice.
      alt={post.coverImageAlt ?? ""}
      fill
      sizes={sizes}
      className="object-cover"
      preload={lead}
      fetchPriority={lead ? "high" : undefined}
      loading={lead ? "eager" : undefined}
    />
  );
}

function Meta({ post }: { post: BlogCardPost }) {
  return (
    <p className="blog-meta">
      {post.publishedAt ? (
        <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
      ) : null}
      <span aria-hidden="true">·</span>
      <span>{post.readingMinutes} min read</span>
      {post.authorName ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{post.authorName}</span>
        </>
      ) : null}
    </p>
  );
}

export function BlogCard({ post, lead = false }: { post: BlogCardPost; lead?: boolean }) {
  return (
    <article className="blog-card group">
      <Link href={`/blog/${post.slug}`} className="blog-media" aria-label={post.title}>
        <Cover post={post} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" lead={lead} />
      </Link>
      <div className="blog-body">
        {post.category ? <span className="blog-kicker">{post.category.name}</span> : null}
        <h3 className="blog-title">
          {/*
            The whole card is not one link. A single anchor wrapping the image
            and the text gives a screen reader one enormous link name; two
            links with clear names is what a reader actually wants.
          */}
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {post.title}
          </Link>
        </h3>
        {post.excerpt || post.subtitle ? (
          <p className="blog-excerpt">{post.excerpt ?? post.subtitle}</p>
        ) : null}
        <Meta post={post} />
      </div>
    </article>
  );
}

/** The lead article, given twice the room at the top of the listing. */
export function BlogFeature({ post }: { post: BlogCardPost }) {
  return (
    <article className="blog-feature group">
      <Link href={`/blog/${post.slug}`} className="blog-feature-media" aria-label={post.title}>
        <Cover post={post} sizes="(max-width: 1024px) 100vw, 50vw" lead />
      </Link>
      <div className="blog-feature-body">
        <span className="blog-kicker">{post.category?.name ?? "Featured"}</span>
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-brand-950 sm:text-3xl">
          <Link href={`/blog/${post.slug}`} className="hover:text-brand-700">{post.title}</Link>
        </h2>
        {post.subtitle ? <p className="text-base text-brand-600">{post.subtitle}</p> : null}
        {post.excerpt ? <p className="line-clamp-3 text-sm leading-relaxed text-brand-600">{post.excerpt}</p> : null}
        <Meta post={post} />
      </div>
    </article>
  );
}
