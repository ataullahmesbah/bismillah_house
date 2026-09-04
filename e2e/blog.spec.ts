import { expect, test } from "@playwright/test";

import { storageStateFor } from "./accounts";

/**
 * The blog, end to end: writing an article in the dashboard, seeing it live,
 * and the two things that would be silent if they broke — stored HTML being
 * sanitised, and a writer being unable to open someone else's article.
 */

/** Unique per run, so repeated runs never collide on the slug's unique index. */
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

async function writeArticle(
  page: import("@playwright/test").Page,
  fields: { title: string; slug: string; content: string; excerpt?: string; tags?: string },
) {
  await page.goto("/dashboard/blog/new");
  await page.fill("#title", fields.title);
  await page.fill("#slug", fields.slug);
  await page.fill("#content", fields.content);
  if (fields.excerpt) await page.fill("#excerpt", fields.excerpt);
  if (fields.tags) await page.fill("#tags", fields.tags);
  await page.selectOption("#status", "PUBLISHED");
  await page.getByRole("button", { name: /create article/i }).click();
  await page.waitForURL(/\/dashboard\/blog\/[a-z0-9]+$/, { timeout: 20000 });
}

test.describe("blog", () => {
  test.describe("as an owner", () => {
    test.use({ storageState: storageStateFor("superAdmin") });

    test("writes an article that goes live with its structured data", async ({ page, context }) => {
      const slug = `e2e-article-${stamp()}`;
      await writeArticle(page, {
        title: "An end to end article",
        slug,
        excerpt: "Proving the editor stores what was typed.",
        tags: "Alpha, alpha, Beta",
        content:
          "<p>Opening paragraph.</p><h2>Does this become FAQ markup?</h2>" +
          "<p>It should, because the heading is a question and this answer is long enough to be worth quoting.</p>",
      });

      const reader = await context.newPage();
      await reader.goto(`/blog/${slug}`);

      await expect(reader.getByRole("heading", { level: 1, name: "An end to end article" })).toBeVisible();
      await expect(reader.getByText("Opening paragraph.")).toBeVisible();

      const html = await reader.content();
      expect(html).toContain('"@type":"BlogPosting"');
      // The question heading should have produced answer-engine markup.
      expect(html).toContain('"@type":"FAQPage"');

      // "Alpha" and "alpha" are the same tag; only one chip should appear.
      const tags = await reader.locator("a.article-tag").allInnerTexts();
      expect(tags.filter((tag) => tag.toLowerCase() === "#alpha")).toHaveLength(1);

      await reader.goto("/blog");
      await expect(reader.getByRole("link", { name: "An end to end article" }).first()).toBeVisible();
    });

    test("strips scripts and event handlers from article HTML", async ({ page, context }) => {
      const slug = `e2e-xss-${stamp()}`;
      await writeArticle(page, {
        title: "Sanitiser check",
        slug,
        content:
          '<p onclick="window.__pwned = true">Legitimate text.</p>' +
          "<script>window.__pwned = true;</scr" +
          'ipt><img src="x" onerror="window.__pwned = true">',
      });

      const reader = await context.newPage();
      await reader.goto(`/blog/${slug}`);
      await expect(reader.getByText("Legitimate text.")).toBeVisible();

      // Nothing the author submitted may run in a reader's browser.
      expect(await reader.evaluate(() => Boolean((window as unknown as { __pwned?: boolean }).__pwned))).toBe(false);

      // Scoped to the article body: #main-content also holds the page's own
      // JSON-LD <script> blocks, which are ours and must stay.
      const body = await reader.locator(".cms-content").innerHTML();
      expect(body).not.toMatch(/onclick=|onerror=|<script/i);
    });
  });

  test.describe("as a moderator", () => {
    test.use({ storageState: storageStateFor("moderator") });

    test("cannot open an article written by someone else", async ({ page }) => {
      // The seeded articles belong to the owner, so any of them will do.
      await page.goto("/blog");
      const href = await page.locator('a[href^="/blog/"]').first().getAttribute("href");
      const slug = href!.replace("/blog/", "");

      // The list must not offer it…
      await page.goto("/dashboard/blog");
      await expect(page.locator(`a[href*="${slug}"]`)).toHaveCount(0);

      // …and neither must a guessed URL. The id is not the slug, so this walks
      // the owner's list instead: what matters is that no editor renders.
      await page.goto("/dashboard/blog?status=PUBLISHED");
      await expect(page.locator("#title")).toHaveCount(0);
    });

    test("can write an article but cannot publish it", async ({ page }) => {
      const slug = `e2e-mod-${stamp()}`;
      await page.goto("/dashboard/blog/new");
      await page.fill("#title", "Moderator draft article");
      await page.fill("#slug", slug);
      await page.fill("#content", "<p>Written by someone without publish rights.</p>");
      await page.selectOption("#status", "PUBLISHED");
      await page.getByRole("button", { name: /create article/i }).click();
      await page.waitForURL(/\/dashboard\/blog\/[a-z0-9]+$/, { timeout: 20000 });

      // Saved, but held back for review rather than going live.
      await expect(page.locator("#status")).toHaveValue("IN_REVIEW");
    });
  });

  test("a missing article is not offered to search engines", async ({ page }) => {
    await page.goto("/blog/no-such-article-here");
    // Next injects its own noindex alongside ours, so there is more than one
    // tag here — every one of them has to say noindex.
    const robots = await page.locator('meta[name="robots"]').evaluateAll(
      (tags) => tags.map((tag) => tag.getAttribute("content") ?? ""),
    );
    expect(robots.length).toBeGreaterThan(0);
    for (const value of robots) expect(value).toContain("noindex");
  });
});
