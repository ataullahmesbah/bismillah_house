import Image from "next/image";
import Link from "next/link";

import { JsonLd, Rating, SectionHeading } from "@/components/ui";
import { ProductGrid } from "@/components/site/product-card";
import { Countdown } from "@/components/site/countdown";
import { ChatWidget } from "@/components/site/chat-widget";
import { getBanners } from "@/lib/services/navigation";
import {
  getActiveFlashSale, getFeaturedCategories, getHomeSections,
  getTestimonials, resolveSectionProducts, type HomeSectionData,
} from "@/lib/services/home";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { optimizedImage } from "@/lib/cloudinary";
import type { Metadata } from "next";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { path: "/", title: settings.seo.defaultTitle });
}

/* -------------------------------------------------------------------------- */

async function HeroSection({ section }: { section: HomeSectionData }) {
  const banners = await getBanners("HOME_HERO", 3);
  const hero = banners[0];

  const ctaButtons = [
    { label: hero?.ctaLabel, href: hero?.linkUrl },
    { label: hero?.secondaryCtaLabel, href: hero?.secondaryLinkUrl },
  ].filter((button): button is { label: string; href: string } =>
    Boolean(button.label?.trim() && button.href?.trim()),
  );

  return (
    <section className="bg-white">
      <div className="tm-container section">
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-[var(--radius-tm-xl)] bg-brand-900 p-8 text-white sm:p-10 lg:col-span-2">
            {hero?.imageUrl ? (
              <Image
                src={hero.imageUrl}
                alt={hero.alt ?? hero.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover opacity-35"
              />
            ) : null}
            <div className="relative max-w-xl">
              <p className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {section.subtitle ?? "Trusted marketplace"}
              </p>
              <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
                {hero?.title ?? section.title ?? "Genuine products, delivered with care"}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-200 sm:text-base">
                {hero?.subtitle ??
                  "Cash on delivery across all 64 districts, transparent pricing and easy returns."}
              </p>
              {/*
                * Both buttons come from the banner. A button needs a label AND
                * a link — a label with no link is a button that goes nowhere —
                * and when neither is configured the row is not rendered at all,
                * so an unconfigured hero has no gap where buttons would be.
                */}
              {ctaButtons.length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  {ctaButtons.map((button, index) => (
                    <Link
                      key={button.href}
                      href={button.href}
                      className={
                        index === 0
                          ? "btn-secondary btn-lg"
                          : "btn-outline btn-lg border-white text-white hover:bg-white hover:text-brand-900"
                      }
                    >
                      {button.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4">
            {banners.slice(1, 3).map((banner) => (
              <Link
                key={banner.id}
                href={banner.linkUrl ?? "/shop"}
                className="group relative flex min-h-40 flex-col justify-end overflow-hidden rounded-[var(--radius-tm-xl)] border border-line bg-surface-sunken p-5"
              >
                {banner.imageUrl ? (
                  <Image
                    src={banner.imageUrl}
                    alt={banner.alt ?? banner.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
                <div className="relative">
                  <p className="text-base font-bold text-brand-950">{banner.title}</p>
                  {banner.subtitle ? <p className="mt-1 text-xs text-brand-600">{banner.subtitle}</p> : null}
                  <span className="btn-link mt-2">{banner.ctaLabel ?? "Explore"} →</span>
                </div>
              </Link>
            ))}
            {banners.length < 2 ? (
              <div className="flex min-h-40 flex-col justify-center rounded-[var(--radius-tm-xl)] border border-dashed border-line-strong bg-white p-5 text-center">
                <p className="text-sm font-semibold text-brand-700">Cash on delivery</p>
                <p className="mt-1 text-xs text-brand-500">Pay only when your parcel arrives.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

async function CategoryGridSection({ section }: { section: HomeSectionData }) {
  const categories = await getFeaturedCategories(12);
  if (categories.length === 0) return null;

  return (
    <section className="tm-container section-tight">
      <SectionHeading
        title={section.title ?? "Shop by category"}
        subtitle={section.subtitle ?? undefined}
        action={<Link href="/shop" className="btn-link">View all →</Link>}
      />
      {/*
        * Square images rather than circles: product photography is shot square,
        * and a circular crop cuts the corners off everything. Two columns on the
        * narrowest phones so the name is readable rather than wrapping to three
        * lines under a thumbnail.
        */}
      <div className="grid grid-cols-2 gap-3 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
        {categories.map((category) => (
          <Link key={category.id} href={`/category/${category.slug}`} className="category-card group">
            <div className="category-card-media">
              {category.imageUrl ? (
                <Image
                  src={optimizedImage(category.imageUrl, 300) ?? category.imageUrl}
                  alt=""
                  width={300}
                  height={300}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-brand-300">
                  {category.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="category-card-body">
              <p className="category-card-name">{category.name}</p>
              <p className="muted-xs">{category._count.products} item{category._count.products === 1 ? "" : "s"}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function FlashSaleSection() {
  const sale = await getActiveFlashSale();
  if (!sale) return null;

  return (
    <section className="tm-container section-tight">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-brand-900 px-4 py-3.5 text-white sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-white">{sale.title}</h2>
            {sale.description ? <p className="text-xs text-brand-300">{sale.description}</p> : null}
          </div>
          <Countdown endsAt={sale.endAt} label="Ends in" />
        </div>
        <div className="card-body">
          <ProductGrid products={sale.products} />
        </div>
      </div>
    </section>
  );
}

async function ProductsSection({ section }: { section: HomeSectionData }) {
  const products = await resolveSectionProducts(section);
  if (products.length === 0) return null;

  const hrefByType: Record<string, string> = {
    FEATURED_PRODUCTS: "/shop?sort=featured",
    TOP_SELLING: "/shop?sort=popular",
    NEW_ARRIVALS: "/shop?sort=newest",
  };

  return (
    <section className="tm-container section-tight">
      <SectionHeading
        title={section.title ?? "Products"}
        subtitle={section.subtitle ?? undefined}
        action={<Link href={hrefByType[section.type] ?? "/shop"} className="btn-link">View all →</Link>}
      />
      <ProductGrid products={products} />
    </section>
  );
}

async function BannerStripSection() {
  const banners = await getBanners("HOME_STRIP", 3);
  if (banners.length === 0) return null;

  return (
    <section className="tm-container section-tight">
      <div className="grid gap-3 sm:grid-cols-3">
        {banners.map((banner) => (
          <Link
            key={banner.id}
            href={banner.linkUrl ?? "/shop"}
            className="relative flex min-h-28 items-center overflow-hidden rounded-[var(--radius-tm-lg)] border border-line bg-white p-4"
          >
            {banner.imageUrl ? (
              <Image src={banner.imageUrl} alt={banner.alt ?? banner.title} fill sizes="33vw" className="object-cover" />
            ) : null}
            <div className="relative">
              <p className="text-sm font-bold text-brand-950">{banner.title}</p>
              {banner.subtitle ? <p className="text-xs text-brand-600">{banner.subtitle}</p> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TrustBadgesSection({ section }: { section: HomeSectionData }) {
  const badges = [
    { title: "Cash on delivery", text: "Pay when your parcel reaches you." },
    { title: "64 districts", text: "Nationwide delivery with clear charges." },
    { title: "Verified reviews", text: "Only customers who received an order can review." },
    { title: "Easy returns", text: "Report an issue and we will make it right." },
  ];

  return (
    <section className="tm-container section-tight">
      {section.title ? <SectionHeading title={section.title} subtitle={section.subtitle ?? undefined} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {badges.map((badge) => (
          <div key={badge.title} className="card p-4">
            <p className="text-sm font-bold text-brand-950">{badge.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-brand-600">{badge.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

async function TestimonialsSection({ section }: { section: HomeSectionData }) {
  const testimonials = await getTestimonials(6);
  if (testimonials.length === 0) return null;

  return (
    <section className="tm-container section-tight">
      <SectionHeading title={section.title ?? "What customers say"} subtitle={section.subtitle ?? undefined} />
      <div className="grid-cards">
        {testimonials.map((testimonial) => (
          <figure key={testimonial.id} className="card p-5">
            <Rating value={testimonial.rating} showCount={false} />
            <blockquote className="mt-3 text-sm leading-relaxed text-brand-700">“{testimonial.body}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {testimonial.name.charAt(0)}
              </span>
              <span>
                <span className="block text-sm font-semibold text-brand-900">{testimonial.name}</span>
                {testimonial.role ? <span className="block text-xs text-brand-500">{testimonial.role}</span> : null}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function RichTextSection({ section }: { section: HomeSectionData }) {
  const html = typeof section.config.html === "string" ? section.config.html : "";
  if (!html) return null;
  return (
    <section className="tm-container section-tight">
      <div className="card-body cms-content" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export default async function HomePage() {
  const [sections, settings] = await Promise.all([getHomeSections(), getSettings()]);

  const renderSection = (section: HomeSectionData) => {
    switch (section.type) {
      case "HERO": return <HeroSection key={section.id} section={section} />;
      case "CATEGORY_GRID": return <CategoryGridSection key={section.id} section={section} />;
      case "FLASH_SALE": return <FlashSaleSection key={section.id} />;
      case "FEATURED_PRODUCTS":
      case "TOP_SELLING":
      case "NEW_ARRIVALS": return <ProductsSection key={section.id} section={section} />;
      case "BANNER": return <BannerStripSection key={section.id} />;
      case "TRUST_BADGES": return <TrustBadgesSection key={section.id} section={section} />;
      case "TESTIMONIALS": return <TestimonialsSection key={section.id} section={section} />;
      case "RICH_TEXT": return <RichTextSection key={section.id} section={section} />;
      default: return null;
    }
  };

  return (
    <>
      {sections.length > 0 ? (
        sections.map(renderSection)
      ) : (
        // Sensible defaults so a brand-new install still shows a real homepage.
        <>
          <HeroSection section={{ id: "hero", key: "hero", type: "HERO", title: null, subtitle: null, config: {} }} />
          <CategoryGridSection section={{ id: "cat", key: "cat", type: "CATEGORY_GRID", title: "Shop by category", subtitle: null, config: {} }} />
          <FlashSaleSection />
          <ProductsSection section={{ id: "feat", key: "feat", type: "FEATURED_PRODUCTS", title: "Featured products", subtitle: null, config: {} }} />
          <ProductsSection section={{ id: "top", key: "top", type: "TOP_SELLING", title: "Top selling", subtitle: null, config: {} }} />
        </>
      )}

      {settings.features.chatbotEnabled ? (
        <ChatWidget assistantName={settings.ai.assistantName} greeting={settings.ai.greeting} />
      ) : null}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: settings.seo.defaultTitle,
          description: settings.seo.defaultDescription,
        }}
      />
    </>
  );
}
