import type { Metadata } from "next";

import { env } from "@/lib/env";
import { stripHtml, truncate } from "@/lib/utils";
import type { SeoSettings } from "@/lib/settings";

/**
 * SEO / GEO / AEO helpers (PRD §24).
 * Every product, category and content page gets real metadata plus JSON-LD;
 * filtered and sorted listing URLs are canonicalised to avoid duplicate content.
 */

export function absoluteUrl(path: string): string {
  const base = env.appUrl.replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type PageSeoInput = {
  title?: string | null;
  description?: string | null;
  path: string;
  image?: string | null;
  noIndex?: boolean;
  type?: "website" | "article" | "product";
  canonical?: string | null;
};

/**
 * The root layout sets a title template (`%s | Trust Mart` by default), which
 * Next applies to every string title a page returns. That is right for "Shop
 * all products" and wrong for a title that already carries the brand — the
 * homepage default, a policy page called "Privacy Policy — Trust Mart", an
 * article whose SEO title the editor ended with the shop name. Those came out
 * as "… — Trust Mart | Trust Mart", which wastes the ~60 characters Google
 * shows and reads as a mistake.
 *
 * Returning `{ absolute }` opts a single page out of the template. It is done
 * here rather than at each call site so no page has to remember.
 */
function titleFor(seo: SeoSettings, raw: string): Metadata["title"] {
  const brand = seo.organizationName.trim();
  const alreadyBranded =
    brand.length > 0 && raw.toLowerCase().includes(brand.toLowerCase());
  return alreadyBranded ? { absolute: raw } : raw;
}

export function buildMetadata(seo: SeoSettings, input: PageSeoInput): Metadata {
  const title = input.title?.trim() || seo.defaultTitle;
  const description = truncate(
    stripHtml(input.description?.trim() || seo.defaultDescription),
    300,
  );
  const canonical = absoluteUrl(input.canonical ?? input.path);
  const image = input.image ?? seo.defaultOgImage;
  const index = seo.robotsIndex && !input.noIndex;

  return {
    title: titleFor(seo, title),
    description,
    alternates: { canonical },
    robots: {
      index,
      follow: index,
      googleBot: { index, follow: index, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: seo.organizationName,
      type: input.type === "product" ? "website" : (input.type ?? "website"),
      images: image ? [{ url: absoluteUrl(image) }] : undefined,
      locale: "en_BD",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [absoluteUrl(image)] : undefined,
    },
    other: {
      "geo.region": seo.geoRegion,
      "geo.placename": seo.geoPlacename,
      "geo.position": `${seo.geoLatitude};${seo.geoLongitude}`,
      ICBM: `${seo.geoLatitude}, ${seo.geoLongitude}`,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                     */
/* -------------------------------------------------------------------------- */

type Json = Record<string, unknown>;

export function organizationJsonLd(seo: SeoSettings, contact: { phone: string; email: string; address: string }): Json {
  const sameAs = seo.organizationSameAs
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.organizationName,
    url: absoluteUrl("/"),
    logo: seo.organizationLogo ? absoluteUrl(seo.organizationLogo) : undefined,
    ...(sameAs.length ? { sameAs } : {}),
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: contact.phone,
        email: contact.email,
        contactType: "customer support",
        areaServed: "BD",
        availableLanguage: ["en", "bn"],
      },
    ],
    address: { "@type": "PostalAddress", streetAddress: contact.address, addressCountry: "BD" },
  };
}

export function websiteJsonLd(seo: SeoSettings): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seo.organizationName,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type ProductJsonLdInput = {
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  sku: string | null;
  brand: string | null;
  price: number;
  currency: string;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
};

/** Only emits AggregateRating when there are genuine reviews — never faked. */
export function productJsonLd(product: ProductJsonLdInput): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ? truncate(stripHtml(product.description), 400) : undefined,
    image: product.image ? [absoluteUrl(product.image)] : undefined,
    sku: product.sku ?? undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/product/${product.slug}`),
      priceCurrency: product.currency,
      price: (product.price / 100).toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(product.ratingCount > 0
      ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: product.ratingAverage.toFixed(1),
          reviewCount: product.ratingCount,
        },
      }
      : {}),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** AEO-friendly FAQ markup for the help centre and product FAQs. */
export function faqJsonLd(faqs: Array<{ question: string; answer: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: stripHtml(faq.answer) },
    })),
  };
}

export type ArticleJsonLdInput = {
  title: string;
  description: string;
  slug: string;
  image?: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName?: string | null;
  section?: string | null;
  tags?: string[];
  wordCount?: number;
};

/**
 * `BlogPosting` for an article.
 *
 * `mainEntityOfPage` is what tells a crawler this markup describes the page it
 * is on rather than something merely referenced from it — without it Google
 * treats the block as a citation and the rich result does not appear.
 */
export function articleJsonLd(seo: SeoSettings, input: ArticleJsonLdInput): Json {
  const url = absoluteUrl(`/blog/${input.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: truncate(input.title, 110),
    description: truncate(stripHtml(input.description), 300),
    url,
    ...(input.image ? { image: [absoluteUrl(input.image)] } : {}),
    datePublished: (input.publishedAt ?? input.updatedAt).toISOString(),
    dateModified: input.updatedAt.toISOString(),
    author: { "@type": "Person", name: input.authorName || seo.organizationName },
    publisher: {
      "@type": "Organization",
      name: seo.organizationName,
      ...(seo.organizationLogo ? { logo: { "@type": "ImageObject", url: absoluteUrl(seo.organizationLogo) } } : {}),
    },
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.tags?.length ? { keywords: input.tags.join(", ") } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    inLanguage: "en-BD",
  };
}

/**
 * The listing page itself. A `Blog` node with its posts listed lets an answer
 * engine enumerate what is here without crawling every article first.
 */
export function blogJsonLd(
  seo: SeoSettings,
  posts: Array<{ slug: string; title: string; publishedAt: Date | null }>,
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": absoluteUrl("/blog"),
    name: `${seo.organizationName} blog`,
    url: absoluteUrl("/blog"),
    inLanguage: "en-BD",
    blogPost: posts.slice(0, 20).map((post) => ({
      "@type": "BlogPosting",
      headline: truncate(post.title, 110),
      url: absoluteUrl(`/blog/${post.slug}`),
      ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    })),
  };
}
