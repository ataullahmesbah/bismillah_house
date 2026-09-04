import { listPublishedSlugs } from "@/lib/services/blog";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/seo";

/**
 * RSS 2.0 for the blog.
 *
 * A feed is the cheapest way for an answer engine or an aggregator to learn
 * that something new exists without crawling the listing on a schedule, and
 * readers still use them.
 */
export const revalidate = 3600;

/**
 * XML has no `&nbsp;` and no bare `&`. Escaping every one of the five
 * predefined entities is what keeps a title containing "Tea & biscuits" from
 * making the whole document unparseable.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [settings, posts] = await Promise.all([getSettings(), listPublishedSlugs(50)]);
  const title = `${settings.seo.organizationName} blog`;
  const self = absoluteUrl("/blog/feed.xml");

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      return `    <item>
      <title>${xml(post.title)}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      ${post.excerpt ? `<description>${xml(post.excerpt)}</description>` : ""}
      ${post.publishedAt ? `<pubDate>${post.publishedAt.toUTCString()}</pubDate>` : ""}
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(title)}</title>
    <link>${xml(absoluteUrl("/blog"))}</link>
    <description>${xml(settings.seo.defaultDescription)}</description>
    <language>en-bd</language>
    <atom:link href="${xml(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
