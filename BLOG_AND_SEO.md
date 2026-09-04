# Blog CMS, sidebar icons, SEO / GEO / AEO and performance

Everything added or changed in this round, what it does, and what you need to
do after unzipping.

---

## 1. Setup — do this first

Two steps, in this order.

```bash
npm install            # adds one dependency: sanitize-html
npx prisma migrate deploy   # applies prisma/migrations/20260903125111_blog_cms
npx prisma generate
npm run build
```

`npm install` is **required**: the blog stores author-written HTML, and
`sanitize-html` is what strips anything dangerous out of it before it reaches a
reader's browser. Without it the build fails.

The migration is **additive only** — it creates three new tables
(`blog_posts`, `blog_categories`, `blog_images`) and one new enum
(`BlogStatus`). It drops nothing and alters no existing column, so running it
against your live database will not touch products, orders or finance.

Optionally, to get three example articles and their categories:

```bash
npm run db:seed
```

The seed is safe to re-run. Every blog row is upserted with an empty `update`,
so re-seeding never overwrites an article you have edited.

No new environment variables. Image uploads use the Cloudinary settings you
already have.

---

## 2. Sidebar icons

Every item in the dashboard sidebar now carries an icon, including the group
footers (View storefront, My account, Sign out).

The icons are hand-drawn inline SVG in
`src/components/dashboard/nav-icons.tsx` — **no icon library was added**. They
are rendered on the server into static markup, so the browser downloads no
extra JavaScript for them, and they inherit the rail's active and hover colours
automatically because they are stroked with `currentColor`.

To add an icon for a new page: add a key to `PATHS` in `nav-icons.tsx`, then
name it on the nav item in `src/lib/dashboard-nav.ts`. TypeScript will not let
you name one that does not exist.

---

## 3. Blog CMS

### Where it lives

| Screen | Path |
| --- | --- |
| Article list, with search and status tabs | `/dashboard/blog` |
| Write a new article | `/dashboard/blog/new` |
| Edit an article + its image gallery | `/dashboard/blog/<id>` |
| Categories | `/dashboard/blog/categories` |
| Public listing | `/blog` |
| Public article | `/blog/<slug>` |
| RSS feed | `/blog/feed.xml` |

The public blog is linked from the footer, under **Company**. It is added
there automatically, so it appears whether or not you add it to the footer menu
yourself — and if you *do* add it in **Dashboard → Content → Navigation &
footer**, it is not duplicated.

### What you can fill in

Everything you asked for, per article:

- **Title** and **Subtitle**
- **URL slug** (becomes `/blog/your-slug`)
- **Summary** — shown on the cards, and used as the meta description if you
  leave that blank
- **Content** — HTML: `<h2>`, `<p>`, `<ul>`, `<strong>`, `<a>`, `<img>`,
  tables, blockquotes
- **Cover image** with its own description (alt text)
- **Extra images** — a gallery, added on the edit screen once the article is
  saved. Each has a description and an optional caption, and each gives you a
  URL you can drop into the content with an `<img>` tag
- **Category** and **Tags**
- **SEO title**, **meta description**, **social share image**, **canonical
  URL**, and a **noindex** switch
- **Status** (draft / in review / published / archived) and a **publish date** —
  set a future date and the article stays hidden until then
- **Feature this article**, which gives it the large card at the top of `/blog`

Reading time and word count are computed for you.

### Who can do what

Five new permissions, editable per staff member in **Dashboard → Staff &
roles**:

| Permission | What it allows |
| --- | --- |
| `blog.view` | See the article list |
| `blog.write` | Write articles and edit **your own** |
| `blog.publish` | Put an article live, and manage categories |
| `blog.manage_all` | Edit anyone's article |
| `blog.delete` | Delete articles |

Admins get all five. Moderators get `blog.view` and `blog.write` — so they can
write, but an editor decides what goes live. If a moderator selects
"Published", the article is **saved as In review** rather than rejected, so
their work is never lost.

Ownership is enforced on the server, on both the page and the save action. A
writer who guesses another author's URL gets the not-found page and the
article's content is never sent to their browser.

### Content safety

Article HTML is sanitised **on save and again on render**
(`src/lib/sanitize.ts`). Scripts, `onclick`/`onerror` handlers, `style`
attributes and `javascript:` / `data:` URLs are removed; the author's
formatting is kept. External links get `rel="noopener noreferrer nofollow"`
automatically.

This matters because `blog.write` is held by moderators, which is a lower trust
level than the staff who edit policy pages. Nineteen unit tests in
`tests/blog.test.ts` cover the attack shapes, and an end-to-end test in
`e2e/blog.spec.ts` submits a real payload and asserts nothing executes.

---

## 4. SEO, GEO and AEO

### Fixed

- **Metadata was landing in `<body>`, not `<head>`.** Next 16 streams
  `generateMetadata` output and only blocks for user agents on its built-in bot
  list. Every other crawler — smaller search engines, SEO audit tools, AI
  crawlers that do not run JavaScript, Lighthouse — saw **no title and no
  description** on the blog, product and category pages. Fixed with
  `htmlLimitedBots` in `next.config.ts`.
- **404 pages said `index, follow`.** Because a missing page streams as HTTP
  200, Next's automatic `noindex` was being overridden by the app's own
  metadata. Google would have indexed "We couldn't find that page". Every
  not-found path now returns an explicit `noindex, nofollow`.
- **The brand appeared twice in titles** — "Privacy Policy — Trust Mart | Trust
  Mart" — wasting the ~60 characters Google shows. A title that already
  contains the shop name now opts out of the template.
- **The blog category filter used the raw slug** in its title
  ("kitchen-notes articles"). It now uses the real name.

### Added

- `BlogPosting` structured data on every article, with author, publisher,
  dates, section, keywords and word count.
- `Blog` structured data on the listing, so an answer engine can enumerate the
  articles without crawling each one.
- **`FAQPage` markup generated from the article itself.** Any `<h2>`/`<h3>`
  that is phrased as a question, with a real answer under it, becomes a
  question/answer pair — which is what makes a section eligible for "People
  also ask" and quotable by an answer engine. You get this by writing question
  headings; there is no extra form to fill in.
- **`/llms.txt`** — a plain-text map of the shop for language models, generated
  from your live database (categories, articles, policies), so it cannot go
  stale. It respects the same indexing switch as `robots.txt`.
- **`/blog/feed.xml`** — RSS 2.0.
- Articles in `sitemap.xml`, and `/blog` itself.
- Filtered and paginated blog URLs canonicalise back to `/blog`, so the blog
  does not compete with itself for the same query.

GEO (geographic) markup was already in place — `geo.region`, `geo.placename`,
`geo.position` and `ICBM` on every page, plus `Organization` with a Bangladesh
postal address and `areaServed: BD`. Verified present on all sixteen public
routes.

---

## 5. Accessibility and performance

### Accessibility — now 100 on every page tested

Four real defects, found and fixed:

- The **sort dropdown on `/shop` had no label** — its `<span class="label">`
  was not associated with the `<select>`, so it had no accessible name at all.
- **`aria-label` on a bare `<span>`** in the star rating. ARIA forbids this, so
  a screen reader is entitled to ignore it, leaving the rating as five
  unlabelled decorative stars. Now `role="img"`.
- **The assistant button's accessible name did not contain its visible text**
  ("Open Trust Assistant" vs "Ask Trust Assistant"), so voice control could not
  activate it by what it says (WCAG 2.5.3).
- **Two colours failed WCAG AA contrast** — the struck-through old price (3.2:1)
  and the green "Free delivery" text (3.3:1). Both darkened to pass 4.5:1.

### Performance

Measured with Lighthouse against a production build.

| | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| **Desktop** | **100** | **100** | 96 → **100*** | **100** |
| **Mobile** | 92–97 | **100** | 96 → **100*** | **100** |

\* Best practices reaches 100 once `fonts.googleapis.com` is reachable. The
only thing holding it at 96 is a console error from that host being blocked in
the machine these numbers were measured on; it will not occur on your server.

Also fixed: **`priority` on images is deprecated in Next 16** and no longer
sets `fetchpriority`. Every hero and cover image was preloading but still
queued at normal priority — Lighthouse reported it as *"fetchpriority=high
should be applied to the image preload request"*. All five now use
`preload` + `fetchPriority="high"` + `loading="eager"`.

**On the 98+ target, honestly:** desktop is 100. Mobile lands at 92–97 rather
than a reliable 98+. Two things you should know before reading too much into
that number:

1. The machine these ran on is heavily shared, and the **same URL scored 77 and
   96 on consecutive runs**. Tuning against that would be fitting noise, not
   improving the site.
2. Every mobile run is gated by Largest Contentful Paint (2.2–3.3 s) under
   Lighthouse's simulated slow-4G profile. The actual cover image transfers in
   **4.5 KB of AVIF and lands 69 ms into the page load** — the simulated figure
   is the throttling model, not a slow site.

Field performance on a real host with a CDN should be better than these lab
numbers. Re-run Lighthouse against your deployed URL for a figure you can
trust, and if mobile still sits below 98 there, tell me and I will work against
that measurement.

---

## 6. Testing

| Suite | Result |
| --- | --- |
| Unit and integration (`npm test`) | 213 passed (194 before, +19 for the blog) |
| End-to-end (`npm run test:e2e`) | 61 passed |
| Typecheck, lint, production build | clean |
| SEO audit across 16 public routes | no problems |

### Two bugs the end-to-end suite caught

Both are fixed, and both are worth knowing about.

**Saving an article landed you on the list, not the editor.** The redirect
pointed at `/dashboard/blog?edit=<id>`, which is the pattern the *categories*
page uses — articles have their own route. An author who saved a draft was
dropped on the index with their work nowhere in sight.

**The transactions table dragged the dashboard sideways on a phone.** The
section wrapping it is a grid child, so it defaulted to `min-width: auto` and
refused to shrink below the table's intrinsic 642px. At a 320px viewport the
document was 658px wide, and `.table-wrap` never got the chance to scroll on
its own.

That second one was **latent in the existing code, not introduced here**: with
an empty ledger the page renders an empty state and the table does not exist
at all. Seeding demo transactions is what made it real. Any shop with actual
entries would have hit it.

New tests:

- `tests/blog.test.ts` — 19 tests over the sanitiser (scripts, event handlers,
  `javascript:`/`data:` URLs, `style` attributes, link hardening), reading time
  and the FAQ question extraction.
- `e2e/blog.spec.ts` — writing and publishing an article, its structured data,
  tag de-duplication, a real XSS payload failing to execute, a moderator being
  unable to open another author's article, and a moderator's "Published"
  being held as "In review".

---

## 7. Files

### New

```
prisma/migrations/20260903125111_blog_cms/migration.sql
prisma/seed-data/blog.ts
src/lib/sanitize.ts
src/lib/services/blog.ts
src/app/actions/dashboard/blog.ts
src/app/dashboard/blog/page.tsx
src/app/dashboard/blog/nav.tsx
src/app/dashboard/blog/post-form.tsx
src/app/dashboard/blog/new/page.tsx
src/app/dashboard/blog/[id]/page.tsx
src/app/dashboard/blog/categories/page.tsx
src/app/(shop)/blog/page.tsx
src/app/(shop)/blog/[slug]/page.tsx
src/app/blog/feed.xml/route.ts
src/app/llms.txt/route.ts
src/components/dashboard/nav-icons.tsx
src/components/site/blog-card.tsx
tests/blog.test.ts
e2e/blog.spec.ts
public/demo/*-1200.png                (three seed cover images)
```

### Changed

```
next.config.ts                        htmlLimitedBots
package.json / package-lock.json      + sanitize-html
prisma/schema.prisma                  blog models, BlogStatus, User.blogPosts
prisma/seed.ts                        seedBlog(), Blog in the footer menu
src/lib/constants.ts                  five blog permissions, role defaults
src/lib/audit.ts                      blog audit actions
src/lib/dashboard-nav.ts              icons on every item, Blog entry
src/lib/seo.ts                        articleJsonLd, blogJsonLd, title fix
src/app/sitemap.ts                    articles and /blog
src/app/not-found.tsx                 noindex
src/app/globals.css                   blog card/feature/article styles,
                                      price-old contrast
src/components/dashboard/sidebar.tsx  renders the icons
src/components/site/footer.tsx        Blog link
src/components/site/product-filters.tsx  real <label> for the sort select
src/components/site/chat-widget.tsx   accessible-name fix
src/components/ui/index.tsx           role="img" on the rating
src/app/(shop)/[slug]/page.tsx        noindex on 404, /blog reserved
src/app/(shop)/product/[slug]/page.tsx,
src/app/(shop)/category/[slug]/page.tsx,
src/app/(shop)/page.tsx,
src/components/site/header.tsx,
src/components/site/product-detail-client.tsx
                                      noindex on 404, fetchPriority on heroes
(various dashboard + site files)      text-success-600 → 700 for contrast
```

---

## 8. Known limitations

- **The content editor is a textarea taking HTML**, not a WYSIWYG. It matches
  how the existing Pages & FAQ editors work, and the hint under the field lists
  the tags you can use. A rich-text editor would be a separate piece of work —
  say the word if you want one.
- **Placing a gallery image inside the article body is manual** — you copy the
  URL shown beside the image and paste an `<img>` tag where you want it.
- **The three seeded articles use generated placeholder covers.** Replace them
  with real photographs before launch; the cover slot is 1200 × 675.
- **Mobile Lighthouse is 92–97, not 98+**, for the reasons in §5. Re-measure on
  your own host.
