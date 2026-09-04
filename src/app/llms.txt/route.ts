import { listPublishedSlugs } from "@/lib/services/blog";
import { prisma, safeQuery } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/seo";

/**
 * `/llms.txt` — a plain-text map of the site for answer engines.
 *
 * The convention (llmstxt.org) is to a language model what `robots.txt` is to
 * a crawler: a short, curated index in Markdown, so a model answering "does
 * Trust Mart deliver to Sylhet?" can find the shipping page without inferring
 * the site structure from a rendered React tree.
 *
 * It is generated from the same database the pages are, so it cannot drift out
 * of date the way a hand-written one would. When indexing is switched off in
 * the dashboard this refuses, like `robots.txt` does — one switch, both files.
 */
export const revalidate = 3600;

export async function GET() {
  const settings = await getSettings();

  if (!settings.seo.robotsIndex) {
    return new Response("# Indexing is disabled for this site.\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const [categories, posts, pages] = await Promise.all([
    safeQuery(
      () =>
        prisma.category.findMany({
          where: { isActive: true, deletedAt: null, parentId: null },
          select: { slug: true, name: true, description: true },
          orderBy: { position: "asc" },
          take: 30,
        }),
      [],
      "llmsCategories",
    ),
    listPublishedSlugs(30),
    safeQuery(
      () =>
        prisma.page.findMany({
          where: { isPublished: true, noIndex: false },
          select: { slug: true, title: true, excerpt: true },
          orderBy: { position: "asc" },
          take: 20,
        }),
      [],
      "llmsPages",
    ),
  ]);

  const line = (title: string, path: string, note?: string | null) =>
    `- [${title}](${absoluteUrl(path)})${note ? `: ${note.replace(/\s+/g, " ").slice(0, 160)}` : ""}`;

  const body = `# ${settings.seo.organizationName}

> ${settings.seo.defaultDescription}

An online shop serving all 64 districts of Bangladesh, with cash on delivery as
the default payment method. Prices are in Bangladeshi taka (BDT, ৳).

## Shopping

${line("All products", "/shop", "The full catalogue, with filters for price, stock and sale items")}
${line("Search", "/search", "Product search")}
${line("Track an order", "/track-order", "Live delivery status from an order number or phone number")}
${line("Contact", "/contact", "Phone, email and a support form")}

## Categories

${categories.map((category) => line(category.name, `/category/${category.slug}`, category.description)).join("\n")}

## Blog

${line("All articles", "/blog", "Buying guides, kitchen notes and shop updates")}
${line("RSS feed", "/blog/feed.xml")}

${posts.map((post) => line(post.title, `/blog/${post.slug}`, post.excerpt)).join("\n")}

## Policies and help

${pages.map((page) => line(page.title, `/${page.slug}`, page.excerpt)).join("\n")}
${line("FAQ", "/faq", "Common questions about delivery, returns and payment")}
${line("Help centre", "/help")}

## Notes

- Delivery charges are set per district and shown at checkout before the order
  is confirmed.
- Returns: seven days from delivery to report a problem.
- Sitemap: ${absoluteUrl("/sitemap.xml")}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
