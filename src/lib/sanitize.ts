import sanitizeHtml from "sanitize-html";

/**
 * Server-side HTML sanitising for anything a staff member types that later
 * reaches a visitor's browser as markup.
 *
 * The blog is the reason this exists. `blog.write` is held by moderators, who
 * are a lower trust level than the `content.manage` staff who edit policy
 * pages, and article bodies are rendered with `dangerouslySetInnerHTML`. Without
 * this, a moderator could store a `<script>` tag that runs for every visitor —
 * and for every admin who opens the article to review it.
 *
 * It runs on save AND again on render. Sanitising once on the way in would be
 * enough for anything written after this shipped, but rows already in the
 * database were never checked, and a future code path could write one without
 * going through the action.
 */

/** Tags an article body may contain. Everything else is unwrapped or dropped. */
const ALLOWED_TAGS = [
  "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr", "blockquote", "pre", "code",
  "strong", "b", "em", "i", "u", "s", "mark", "sup", "sub", "small",
  "ul", "ol", "li",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "div", "span",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
    // Class is allowed so an author can reach the CMS content styles, but no
    // `style` attribute anywhere: inline CSS is how a stored payload hides a
    // full-page overlay over the real page.
    "*": ["class", "id"],
    th: ["class", "id", "colspan", "rowspan", "scope"],
    td: ["class", "id", "colspan", "rowspan"],
  },
  // No `data:` — an `<img src="data:text/html,...">` is a script in disguise on
  // some browsers, and nothing legitimate here needs it.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  // `h1` belongs to the page title; demote a stray one rather than dropping the
  // author's words with it.
  transformTags: {
    h1: "h2",
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: {
          ...attribs,
          // An author cannot make a link that hands the opened tab a handle
          // back to ours (`window.opener`), whatever they typed.
          ...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}),
        },
      };
    },
  },
  // Comments can carry markup that some parsers un-comment. Nothing needs them.
  allowedIframeHostnames: [],
  disallowedTagsMode: "discard",
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * Plain text from HTML — for reading-time counts, excerpt fallbacks and meta
 * descriptions, where tags would otherwise be counted as words or leak into
 * a `<meta>` tag.
 */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** 200 words per minute, floored at one — "0 min read" reads as broken. */
export function readingMinutes(html: string): number {
  const words = htmlToText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Question-shaped headings and the prose that answers them.
 *
 * An article section headed "What about the white coating?" followed by a
 * paragraph explaining it is a question and an answer, and marking it up as one
 * is what makes it eligible for the "People also ask" block and for an answer
 * engine to quote. This reads the structure the author already wrote rather
 * than asking them to fill in a second set of fields.
 *
 * The HTML reaching this has been through `sanitizeRichText`, so the tag soup a
 * regex would choke on is already gone.
 */
export function extractQuestions(html: string): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  // Split on h2/h3 openings, keeping the heading text and everything up to the
  // next heading of either level.
  const sections = html.split(/(?=<h[23][\s>])/i);

  for (const section of sections) {
    const heading = section.match(/^<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    if (!heading) continue;

    const question = htmlToText(heading[1]);
    // Only genuine questions. A heading like "Keep them airtight" is a section
    // title, not something anybody typed into a search box.
    if (!question.endsWith("?")) continue;

    const answer = htmlToText(section.slice(heading[0].length));
    // Too short to be an answer, or long enough that quoting it whole would
    // misrepresent the article.
    if (answer.length < 40) continue;

    out.push({ question, answer: answer.slice(0, 1200) });
  }

  return out.slice(0, 10);
}
