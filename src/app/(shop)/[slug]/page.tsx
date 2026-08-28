import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumb, JsonLd } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { formatDate, stripHtml, truncate } from "@/lib/utils";

/**
 * CMS page renderer — Terms, Privacy, Shipping, Returns, Refund policy and any
 * other page the owner creates in the dashboard. Content is authored by staff,
 * so it is rendered as trusted HTML inside `.cms-content`.
 */

type Params = Promise<{ slug: string }>;

/** Route names owned by real pages must never be captured by this catch-all. */
const RESERVED = new Set([
  "shop", "cart", "checkout", "search", "product", "category", "track-order",
  "help", "faq", "contact", "login", "register", "account", "dashboard", "api",
  "order-confirmation", "forgot-password", "reset-password",
]);

async function loadPage(slug: string) {
  if (RESERVED.has(slug)) return null;
  return prisma.page.findFirst({
    where: { slug, isPublished: true },
    select: {
      id: true, slug: true, title: true, excerpt: true, content: true,
      seoTitle: true, seoDescription: true, noIndex: true, updatedAt: true,
    },
  });
}

/*
 * Rendered per request rather than prerendered.
 *
 * These pages sit inside the shop layout, whose header reads cookies to show
 * the signed-in customer and their cart. That makes the whole tree dynamic,
 * which contradicts static generation: the build succeeds, but the first
 * `revalidatePath` — saving a setting, placing an order, clearing
 * notifications — invalidates the cached copy, and Next then tries to
 * regenerate it statically, hits `cookies()` and fails the render with
 * DYNAMIC_SERVER_USAGE. Every policy page would start returning 500 some time
 * after launch, with nothing in the deploy to explain why.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [page, settings] = await Promise.all([loadPage(slug), getSettings()]);
  if (!page) return { title: "Page not found" };

  return buildMetadata(settings.seo, {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? page.excerpt ?? truncate(stripHtml(page.content), 200),
    path: `/${page.slug}`,
    noIndex: page.noIndex,
    type: "article",
  });
}

export default async function CmsPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  return (
    <div className="tm-container-narrow section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: page.title }]} />
      <article className="card mt-4">
        <div className="card-body">
          <h1 className="page-title">{page.title}</h1>
          <p className="muted-xs mt-1">Last updated {formatDate(page.updatedAt)}</p>
          {page.excerpt ? <p className="mt-3 text-base text-brand-600">{page.excerpt}</p> : null}
          <div className="divider" />
          <div className="cms-content" dangerouslySetInnerHTML={{ __html: page.content }} />
        </div>
      </article>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: page.title, path: `/${page.slug}` }])} />
    </div>
  );
}
