import { describe, expect, it } from "vitest";

import { extractQuestions, htmlToText, readingMinutes, sanitizeRichText } from "@/lib/sanitize";

/**
 * The sanitiser is the only thing between a `blog.write` moderator and stored
 * XSS on every visitor's browser, so the cases below are the attack shapes
 * rather than a happy path.
 */
describe("sanitizeRichText", () => {
  it("drops script tags and keeps the prose around them", () => {
    const out = sanitizeRichText('<p>Before</p><script>alert(1)</script><p>After</p>');
    expect(out).not.toMatch(/script/i);
    expect(out).toContain("Before");
    expect(out).toContain("After");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeRichText('<p onclick="steal()" onmouseover="x()">Text</p>');
    expect(out).not.toMatch(/onclick|onmouseover/i);
    expect(out).toContain("Text");
  });

  it("removes an img whose onerror would fire", () => {
    const out = sanitizeRichText('<img src="x" onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });

  it("refuses javascript: and data: URLs", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">Click</a>')).not.toMatch(/javascript:/i);
    expect(sanitizeRichText('<img src="data:text/html,<script>alert(1)</script>">')).not.toMatch(/data:/i);
  });

  it("keeps http, https, mailto and tel links", () => {
    const out = sanitizeRichText(
      '<a href="https://example.com">a</a><a href="mailto:x@y.com">b</a><a href="tel:+8801700000000">c</a>',
    );
    expect(out).toContain("https://example.com");
    expect(out).toContain("mailto:x@y.com");
    expect(out).toContain("tel:+8801700000000");
  });

  it("hardens external links against window.opener", () => {
    const out = sanitizeRichText('<a href="https://example.com">out</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it("leaves internal links alone", () => {
    const out = sanitizeRichText('<a href="/shop">shop</a>');
    expect(out).not.toContain("target=");
  });

  it("strips the style attribute, which can hide a full-page overlay", () => {
    const out = sanitizeRichText('<div style="position:fixed;inset:0;z-index:9999">x</div>');
    expect(out).not.toMatch(/style=/i);
  });

  it("demotes a stray h1 rather than dropping the words", () => {
    const out = sanitizeRichText("<h1>Heading</h1>");
    expect(out).toContain("Heading");
    expect(out).not.toMatch(/<h1/i);
    expect(out).toMatch(/<h2/i);
  });

  it("keeps the formatting an author actually uses", () => {
    const html = "<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul>";
    const out = sanitizeRichText(html);
    for (const tag of ["<h2", "<strong", "<em", "<ul", "<li"]) expect(out).toContain(tag);
  });
});

describe("htmlToText", () => {
  it("returns prose with tags and entities resolved", () => {
    expect(htmlToText("<p>Tea &amp; biscuits</p>")).toBe("Tea & biscuits");
  });

  it("collapses the whitespace that indentation leaves behind", () => {
    expect(htmlToText("<p>a</p>\n\n   <p>b</p>")).toBe("a b");
  });
});

describe("readingMinutes", () => {
  it("never returns zero — '0 min read' reads as broken", () => {
    expect(readingMinutes("<p>Two words</p>")).toBe(1);
  });

  it("counts words rather than characters", () => {
    const words = Array.from({ length: 1000 }, () => "word").join(" ");
    expect(readingMinutes(`<p>${words}</p>`)).toBe(5);
  });

  it("does not count markup as words", () => {
    const words = Array.from({ length: 200 }, () => "<strong>word</strong>").join(" ");
    expect(readingMinutes(`<p>${words}</p>`)).toBe(1);
  });
});

describe("extractQuestions", () => {
  const article = `
    <p>Intro paragraph that sets the scene for the reader.</p>
    <h2>Keep them airtight</h2>
    <p>This is a section, not a question, and should be ignored entirely.</p>
    <h2>What about the white coating?</h2>
    <p>A white bloom on the skin is sugar that has migrated to the surface, not mould.</p>
    <h3>Is it safe to freeze?</h3>
    <p>Yes — well over a year in the freezer with no loss of texture at all.</p>
  `;

  it("takes only headings that are questions", () => {
    const found = extractQuestions(article).map((q) => q.question);
    expect(found).toEqual(["What about the white coating?", "Is it safe to freeze?"]);
  });

  it("pairs each question with the prose that answers it", () => {
    const [first] = extractQuestions(article);
    expect(first.answer).toContain("sugar that has migrated");
    expect(first.answer).not.toContain("Is it safe to freeze");
  });

  it("skips a question with too little under it to be an answer", () => {
    expect(extractQuestions("<h2>Why?</h2><p>Because.</p>")).toHaveLength(0);
  });

  it("returns nothing for an article with no question headings", () => {
    expect(extractQuestions("<h2>A heading</h2><p>Some text that is definitely long enough.</p>")).toHaveLength(0);
  });
});
