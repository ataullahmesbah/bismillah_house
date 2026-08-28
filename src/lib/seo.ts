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
    title,
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
