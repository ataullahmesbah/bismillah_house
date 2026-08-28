# Trust Mart

A production-oriented, database-driven e-commerce platform for Bangladesh —
storefront, customer accounts, and a role-aware staff dashboard where the
business is run without touching code.

Built with **Next.js 16 (App Router)**, **TypeScript (strict)**, **PostgreSQL**,
**Prisma 7** and **Tailwind CSS 4**.

---

## Contents

- [What is included](#what-is-included)
- [Quick start](#quick-start)
- [Environment configuration](#environment-configuration)
- [Database, migrations and seed](#database-migrations-and-seed)
- [Running, building and testing](#running-building-and-testing)
- [Demo sign-ins](#demo-sign-ins)
- [Project structure](#project-structure)
- [The Tailwind design system](#the-tailwind-design-system)
- [How money is stored](#how-money-is-stored)
- [Pricing, coupons and delivery](#pricing-coupons-and-delivery)
- [Product variants](#product-variants)
- [Invoices](#invoices)
- [Roles and permissions](#roles-and-permissions)
- [Security model](#security-model)
- [Optional integrations](#optional-integrations)
- [Running the shop from the dashboard](#running-the-shop-from-the-dashboard)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## What is included

**Storefront**
Dashboard-composed homepage (hero, category grid, flash sale, featured, top
selling, new arrivals, banner strip, trust badges, testimonials) · shop listing
with filters, sorting and pagination · category and subcategory pages · product
pages with a live variant picker · search · cart · checkout · order
confirmation · public order tracking · help centre, FAQ, contact and policy
pages · AI shopping assistant.

**Customer account**
Order history with a delivery timeline · invoice download · self-service
cancellation · reviews restricted to delivered purchases · address book ·
support messaging · notification centre · password and session management.

**Internal tokens**
Staff-to-staff tickets with a subject, category, priority, description and one
or many assignees · assign to a person or the whole team · replies and status
changes notify everyone involved · each assignee can tick off their own part.

**Staff dashboard**
Overview with server-aggregated charts · products with an advanced variant
matrix · categories, brands and reusable attributes · orders with a status state
machine, internal notes, payments, refunds and fraud review · phone/email
customer-history search · customers and staff · coupons, offers, flash sales and
banners · review moderation · support conversations and contact leads ·
broadcast notifications · CMS for homepage sections, pages, FAQ, navigation and
testimonials · reports · audit and security log · settings for business details,
feature flags, delivery across all 64 districts, payments, courier, SEO/GEO/AEO
and analytics.

**Inventory**
On-hand, reserved and available stock kept apart, so "two left" can be answered
honestly · per-product alert and reorder levels · manual adjustments whose
reason fixes the direction, so a damage write-off cannot add stock · warehouses
with balances summed from the movement ledger rather than stored · incoming
supplier shipments that count as arriving but never as sellable until received ·
the full movement ledger · CSV exports.

**Courier**
Send a confirmed order to the courier from its order screen — the parcel is
created in their system and nobody opens their dashboard · webhook status sync
with HMAC verification · the parcel's journey shown to staff and to the customer
· settlement recording that posts straight into the books · a dispatch log of
every call and its outcome · manual tracking entry for couriers with no API.

**Accounts & finance**
Income and expenses with the categories a Bangladeshi retail shop actually uses
(salary, bonus, gifts, staff food, travel, packaging, courier charges, ads) ·
cash, bank, wallet and courier-receivable accounts · profit & loss · cash flow ·
receivables · orders posting their own revenue and cost · nothing ever
hard-deleted — a wrong entry is voided with a reason and every edit keeps a
revision · CSV exports.

**AI**
Gemini, OpenAI and Claude behind one interface, with fallback between them ·
product drafting where the AI writes and a person approves · usage logging
against a monthly budget · every AI feature degrades to manual work rather than
blocking it.

---

## Quick start

Requires **Node.js 20.11+** and **PostgreSQL 14+**.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure the environment
cp .env.example .env
#    → set DATABASE_URL and AUTH_SECRET (see below)

# 3. Create the schema and fill it with demo data
npm run prisma:migrate
npm run db:seed

# 4. Start the shop
npm run dev
```

Open <http://localhost:3000>. Sign in at `/login` with the demo credentials
printed by the seed (also listed [below](#demo-sign-ins)).

---

## Environment configuration

Every variable is documented inline in [`.env.example`](./.env.example). Only
two are required:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. |
| `AUTH_SECRET` | **Yes** | Session secret. Generate with `openssl rand -base64 32`. |
| `NEXT_PUBLIC_APP_URL` | Production | Canonical URLs, sitemap, OG tags, invoices. |
| `CLOUDINARY_*` | No | Image uploads. Without it you can paste image URLs. |
| `AI_PROVIDER`, `AI_API_KEY` | No | AI assistant. Without it, a catalogue-search fallback is used. |
| `BKASH_*`, `SSLCOMMERZ_*` | No | Payment gateways. Cash on Delivery always works. |
| `COURIER_*` | No | Courier API. Manual tracking numbers always work. |
| `META_CAPI_ACCESS_TOKEN` | No | Meta Conversions API. |
| `SMS_*` | No | Bulk SMS gateway for checkout verification codes. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Google sign-in. Buttons hidden without it. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | No | Free bot check on sign-in and registration. |

> **Secrets live in the environment, never in the database.** Non-secret
> configuration — shop name, GA4 ID, delivery charges, feature flags — is stored
> in PostgreSQL and edited from the dashboard.

---

## Database, migrations and seed

```bash
npm run prisma:migrate     # create/apply migrations in development
npm run prisma:deploy      # apply existing migrations (production)
npm run db:seed            # demo catalogue, districts, coupons, pages, orders
npm run db:reset           # drop, re-migrate and re-seed (destroys data)
npm run prisma:studio      # browse the database
```

The seed creates:

- 5 users (Super Admin, Admin, Moderator, 2 customers)
- all **64 Bangladesh districts** — Dhaka ৳60, every other district ৳120,
  Sylhet free, Chattogram ৳100
- 11 categories, 4 brands, 6 reusable attributes
- 8 products including **21 real variants** (dates 500g/1kg/2kg, shoes 43–45 in
  black and brown, honey 500ml/1L, mustard oil 500ml/1L/2L, t-shirts in
  size × colour)
- 4 coupons (product-specific ৳100, global 10%, a 2-hour coupon, a category
  coupon), one 2-hour offer, one flash sale
- 6 banners, 9 homepage sections, 7 policy pages, 14 FAQ entries, 4 menus
- 2 demo orders with issued invoices
- 1 warehouse, 4 finance accounts, 19 expense categories

**Re-running the seed is safe on a live shop.** Every row is matched by a
natural key, and an existing row is left exactly as it is — the seed only ever
fills in what is missing. Verified against a shop with real data: a product
whose price and description had been edited kept both, an account that had been
suspended and demoted stayed suspended and demoted, a rewritten policy page kept
its text, and products, users and orders added since were untouched.

What it *will* add on a second run is anything new the release introduced —
the warehouse, the chart of accounts, the new settings groups — which is the
point of being able to re-run it after an upgrade.

> Use `npm run db:reset` when you *do* want the demo content back. It drops
> everything first, so it is a development command.

> **Prisma 7 note.** Prisma 7 no longer reads `DATABASE_URL` from the schema.
> The connection is configured in [`prisma.config.ts`](./prisma.config.ts), which
> loads `.env` and passes the URL to the CLI, while the application connects
> through the `@prisma/adapter-pg` driver adapter in [`src/lib/db.ts`](./src/lib/db.ts).

---

## Running, building and testing

```bash
npm run dev          # development server
npm run build        # prisma generate + production build
npm start            # run the production build

npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest — unit + database integration tests
npm run test:e2e     # playwright — end-to-end customer journeys
```

**The production build does not need a database.** Shared loaders fall back to
safe defaults when PostgreSQL is unreachable, so `npm run build` succeeds on a
fresh clone and a transient database blip degrades one section instead of
returning a 500 for the whole page.

The test suite covers the money helpers, the whole pricing engine (variant
pricing, flash sales, offers, coupon eligibility and allocation, all delivery
strategies), the security policies (Super Admin protection, role defaults, the
order state machine, open-redirect blocking, contact masking, audit redaction),
input validation, and — when a database is reachable — inventory oversell
protection, coupon limit atomicity and invoice immutability.

`npm test` skips the database-backed tests automatically when no database is
reachable, so it always runs.

### End-to-end

`npm run test:e2e` needs a seeded database and a built app:

```bash
npm run db:reset && npm run db:seed
npm run build && npm start -- -p 3100     # or let Playwright start it
npm run test:e2e
```

Two suites drive a real browser:

- **`e2e/shop.spec.ts`** — browse → variant → cart → coupon → checkout →
  confirmation → invoice PDF → tracking, plus the rule that one customer can
  never open another's order.
- **`e2e/responsive.spec.ts`** — every public page at 320, 390 and 768 px wide,
  plus the dashboard on a phone, asserting nothing scrolls sideways. Horizontal
  overflow is easy to introduce with one wide table and invisible on a desktop
  browser.
- **`e2e/dashboard.spec.ts`** — the staff side: role-filtered navigation, the
  server-side permission guard, Super Admin protection, the 64-district
  delivery table, coupons, orders, the audited customer search, and a smoke
  pass that renders *every* dashboard route. That last one matters because
  these pages sit behind a permission guard: an unauthenticated request only
  ever sees the redirect to sign-in, so a page that crashes on render stays
  invisible until someone signs in and opens it.

`e2e/auth.setup.ts` signs each seeded role in once and saves the session to
`.playwright/auth`, which the suites reuse. Tests deliberately do not sign in
individually — that would trip the login rate limit the app is supposed to
have.

---

## Demo sign-ins

Created by `npm run db:seed`. **Local development only — change them before
deploying anything publicly.**

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `superadmin@trustmart.local` | `SuperAdmin#2026` |
| Admin | `admin@trustmart.local` | `Admin#2026` |
| Moderator | `moderator@trustmart.local` | `Moderator#2026` |
| Customer | `customer@trustmart.local` | `Customer#2026` |

Set `SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD` in `.env` to seed
your own Super Admin instead.

---

## Project structure

```
prisma/
  schema.prisma            All entities, indexes and constraints
  migrations/              Versioned SQL migrations
  seed.ts                  Development seed
  seed-data/               64 districts, policy pages, FAQ content

src/
  app/
    (shop)/                Public storefront
    (auth)/                Sign in, register, password reset
    (account)/account/     Customer account area
    dashboard/             Staff dashboard (role-filtered)
    api/                   Chat, invoice PDF, signed uploads
    actions/               Server actions, grouped by area
    globals.css            The design system (see below)
    sitemap.ts, robots.ts  Generated from the database

  components/
    ui/                    Presentational primitives
    site/                  Storefront components
    dashboard/             Dashboard components

  lib/
    services/
      pricing.ts           Pure pricing engine — the heart of the money logic
      cart.ts              Cart loading and authoritative quoting
      orders.ts            Order creation, lifecycle, review eligibility
      invoice-builder.ts   Immutable invoice snapshots
      invoice-pdf.ts       Server-side PDF generation
      catalog.ts           Shared catalogue loaders
      products.ts          Search, filtering, product detail
      reports.ts           Server-side aggregation for charts and reports
      ai.ts                Catalogue-grounded assistant
      navigation.ts        Database-driven menus and banners
    auth/                  Sessions, RBAC, guards, password hashing
    validation/            Zod schemas for every external input
    forms/                 Form defaults shared by server and client components
    settings.ts            Dashboard-editable configuration
    money.ts, utils.ts     Shared helpers
    audit.ts               Audit trail with secret redaction
    rate-limit.ts          Durable rate limiting

tests/                     Vitest unit + integration tests
e2e/                       Playwright end-to-end tests
```

---

## The Tailwind design system

Everything visual is defined **once** in
[`src/app/globals.css`](./src/app/globals.css), so a page never repeats a long
utility string.

- **Design tokens** live in `@theme` — colours, the Latin + Bengali font stack,
  radii, shadows. Change a token there and the whole platform follows.
- **Primitives** are registered with Tailwind v4's `@utility` directive (`btn`,
  `card`, `input`, `badge`, `alert`, `status-pill`, `chip`, `nav-link`, …), which
  is what lets other classes `@apply` them.
- **Component classes** in `@layer components` compose those primitives:
  `.btn-primary`, `.card-header`, `.table-wrap`, `.product-card`, `.stat-card`,
  `.summary-row`, `.empty-state`, `.status-delivered`, and so on.

So a page writes:

```tsx
<button className="btn-primary">Place order</button>
<span className="status-delivered">delivered</span>
<div className="card"><div className="card-header">…</div></div>
```

instead of repeating a dozen utilities on every button. To restyle every button
in the shop, edit `.btn-primary` once.

There is one status class per order lifecycle state (`.status-pending`,
`.status-shipped`, `.status-fraud_review`, …), so `statusClass(order.status)`
always produces a correctly coloured pill.

---

## How money is stored

**Every monetary column is an integer in minor units (poisha).** `৳500` is
stored as `50000`. This removes floating-point drift from discounts and totals,
and keeps values safely serialisable between server and client.

Always convert through [`src/lib/money.ts`](./src/lib/money.ts):

```ts
toMinor(500)        // 50000  — taka in, minor units out
fromMinor(50000)    // 500
formatMoney(50000)  // "৳500"
percentOf(50000,10) // 5000
```

---

## Pricing, coupons and delivery

The pricing engine in
[`src/lib/services/pricing.ts`](./src/lib/services/pricing.ts) is pure — it takes
data and returns numbers, with no database or request access. That makes it
fully unit-tested, and it means **a price submitted by a browser can never reach
a calculation**: the checkout reloads every product, variant, coupon and
district from the database and re-runs the engine before writing an order.

Order of operations at checkout:

1. Resolve the variant (or base) price.
2. Apply an active flash-sale price.
3. Apply the best active promotional offer — the customer always gets the lower
   of the flash and offer price. Offers never stack with each other.
4. Resolve coupon eligibility and discount.
5. Calculate delivery from the district plus any product-level overrides.
6. Total, then create the order, its items, the shipping snapshot, the payment
   record and the invoice **in a single transaction**.

### Coupons

Fixed amount or percentage · scope of **global**, **specific products** or
**specific categories** · per-product exclusions · minimum cart amount ·
maximum discount cap · exact start and end date-time (so a two-hour coupon is
just a two-hour window) · total usage limit · per-customer limit ·
"allow on flash-sale items" toggle (off by default) · "allow stacking with
offers" toggle (off by default).

Redemption is atomic: the usage counter is claimed with a conditional update
inside the order transaction, so two simultaneous checkouts can never take the
last use of a coupon.

### Delivery across 64 districts

Each district has its own charge, a free-delivery flag, an active flag and an
estimated delivery time. A **bulk rule** sets one charge for every district
except the ones you exclude (typically Dhaka), then individual districts are
overridden.

The seeded example matches the specification: Dhaka ৳60, all other districts
৳120, Sylhet free, Chattogram ৳100.

Products can override delivery independently — **standard** (use the district
charge), **free**, or a **fixed** product charge. A mixed cart is resolved by a
deterministic strategy chosen in Settings → Delivery:

| Strategy | Behaviour |
| --- | --- |
| `highest` (default) | Bill the single largest applicable charge. |
| `sum` | Add the district charge and every product surcharge. |
| `district_only` | Ignore product surcharges; always bill the district. |

A store-wide free-delivery threshold overrides all of it. The exact breakdown
used is stored on the order, so you can always see what the customer was charged
and why.

---

## Product variants

Variant dimensions are **reusable attributes**, not a hard-coded size/colour
pair. The seed ships Size, Colour, Weight, Volume, Shoe Size and Pack; you can
add any others from Dashboard → Attributes.

Managing a product's variants is three steps:

1. **Choose attributes** for the product (up to six).
2. **Generate combinations** — tick the option values in play and the matrix is
   created in one action. Existing variants are never touched, so adding one new
   colour later creates only the genuinely new rows.
3. **Edit the matrix** — every combination gets its own SKU, price, compare-at
   price, stock, low-stock threshold and image.

Each variant carries its own price and stock, the product's headline price
tracks its cheapest active variant, and inventory is tracked per variant. On the
product page, option values that cannot lead to an in-stock combination are shown
disabled — and the server re-validates the combination anyway.

Cart and order items store an **attribute snapshot**, so a historical order still
reads correctly after the product is edited.

---

## Invoices

Every order gets an immutable invoice with a unique number
(`INV-2026-000123`) drawn from a PostgreSQL sequence inside the order
transaction. The invoice stores a full snapshot — items, variants, prices,
discounts, delivery, totals, payment method and status — so editing a product or
coupon afterwards never changes an issued invoice.

Two surfaces:

- **PDF** — `GET /api/orders/{id-or-public-token}/invoice`, generated
  server-side with `pdf-lib`. No headless browser and no native binaries, so it
  runs unchanged on Vercel, a VPS or a container.
- **Print view** — a print-optimised page at
  `/dashboard/orders/{id}/invoice` and `/account/orders/{id}/invoice`, suitable
  for putting on a delivery package.

Authorisation: the public token is itself the credential (that is how guest
tracking works); an order **id** requires either ownership or staff holding
`order.invoice`. Changing an id in the URL cannot expose another customer's
invoice.

### Bengali text in PDF invoices

The default build uses Helvetica, which covers Latin text; anything it cannot
encode is replaced rather than crashing the download. To render Bengali, drop a
Unicode TTF at `public/fonts/NotoSansBengali-Regular.ttf` (optionally
`NotoSansBengali-Bold.ttf` too) or point `INVOICE_FONT_PATH` at one — it is
embedded automatically on the next request. [Noto Sans Bengali](https://fonts.google.com/noto/specimen/Noto+Sans+Bengali)
is free under the SIL Open Font License. The print view renders Bengali with no
extra setup, because the browser supplies the font.

---

## Roles and permissions

| Role | Scope |
| --- | --- |
| **Super Admin** | Everything. Cannot be edited, demoted or suspended by anyone. |
| **Admin** | Configurable operational access. No ownership controls by default. |
| **Moderator** | Support and moderation only. |
| **Customer** | Their own orders, addresses, reviews and messages. |

Permissions are granular (40 of them, grouped by area) and editable at two
levels: **role grants** in Dashboard → Staff → Role permissions, and
**per-user overrides** on a staff member's profile.

Super Admin protection is enforced in the backend, not the UI:

- nobody — including another Super Admin — can edit or suspend a Super Admin;
- no role can be promoted to Super Admin through the interface;
- only a Super Admin may change roles or role permissions;
- nobody can change their own privileges;
- every role, permission and status change is written to the audit log.

---

## Security model

- **Sessions** are opaque tokens in HttpOnly, SameSite=Lax, Secure-in-production
  cookies. Only a SHA-256 hash is stored, so a database dump cannot be replayed.
  Suspending an account or resetting a password revokes every session
  immediately.
- **Passwords** are bcrypt hashes (cost 12). Failed sign-ins are counted and the
  account locks temporarily; the response and its timing are identical whether or
  not the email exists.
- **Authorisation is always server-side.** Every dashboard page, server action
  and API route calls a guard. Hidden UI is never treated as a permission.
- **IDOR/BOLA** is closed by scoping queries to the owner — `where: { id, userId }`
  rather than fetching and then comparing.
- **Every external input** is parsed with Zod before it reaches the database.
- **Rate limiting** is durable (memory + database) on sign-in, registration,
  password reset, checkout, coupon, contact, review, message, chatbot, upload and
  search.
- **Guest order tracking** requires a non-guessable reference plus the phone
  number on the order, and returns one generic message for both "not found" and
  "wrong phone" so it cannot confirm that an order exists.
- **Audit logging** records the actor, role, action, entity, before/after summary
  and request context. A redaction pass strips passwords, tokens and gateway
  secrets before anything is written.
- **Secrets never reach the browser.** Cloudinary uploads are signed
  server-side, the AI key stays on the server, and gateway credentials live only
  in environment variables.
- **Production errors** show a safe message and a reference; the detail stays in
  the server logs.
- **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS) are applied to every response.
- **Open redirects** are blocked — only same-origin relative paths are accepted
  after sign-in.
- **Customer contact details** are masked from staff without the
  `order.view_contact` permission, and every operational history search is
  audited with the term used.

---

## Optional integrations

Everything below is genuinely optional. The shop is fully usable with none of
them configured — see [`ENV_SETUP.md`](ENV_SETUP.md) for where to get each key
and exactly what changes when it is absent.

| Integration | Without it | To enable |
| --- | --- | --- |
| **Cloudinary** | Paste image URLs manually | Set `CLOUDINARY_*` in `.env` |
| **AI** | Assistant falls back to a catalogue search; product drafting is hidden | Set any one of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Several means fallback between them |
| **bKash** | Cash on Delivery; or enable bKash for manual transaction-ID verification | Set `BKASH_*` |
| **Online card gateway** | Cash on Delivery / bKash | Set `SSLCOMMERZ_*`; payment status is already tracked separately from order status |
| **Courier API** | Staff create the parcel in the courier's dashboard and paste the tracking number back; the timeline, settlements and customer tracking still work | Set `COURIER_<CODE>_*` per courier and register them in the dashboard. The webhook secret is required for status callbacks |
| **Turnstile** | Rate limiting alone guards sign-in | Set both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, then switch it on in Settings → Sign-in security |
| **Google sign-in** | Email and password only | Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, then switch it on in Settings → Sign-in security |
| **GA4 / GTM / Meta Pixel** | No tracking | Paste the IDs in Dashboard → Settings → Analytics |
| **Meta CAPI** | Browser-side pixel only | Set `META_CAPI_ACCESS_TOKEN` and enable it in the dashboard |
| **Email / SMS** | Notifications appear in the in-app notification centre | The notification layer is provider-agnostic — add a transport in `src/lib/notifications.ts` |

---

## Running the shop from the dashboard

No code change is needed for day-to-day business:

| Task | Where |
| --- | --- |
| Shop name, logo, contact details, social links | Settings → Business settings |
| Guest checkout, require login, reviews policy, maintenance mode | Settings → Business settings → Feature switches |
| Delivery charge per district, bulk rule, mixed-cart strategy | Settings → Delivery & districts |
| Payment methods and instructions | Settings → Payments |
| Couriers | Settings → Courier |
| Meta titles, descriptions, GEO data, sitemap behaviour | Settings → SEO / GEO / AEO |
| GA4, GTM, Meta Pixel, consent banner | Settings → Analytics & tracking |
| Header menu, mega menu, footer columns | Content → Navigation & footer |
| Homepage sections and their order | Content → Homepage sections |
| Terms, privacy, shipping, returns, refunds | Content → Pages & policies |
| FAQ (also powers FAQ structured data and the AI assistant) | Content → FAQ |
| Hero images, strips, popups | Banners & ads |
| Coupons, offers, flash sales | Marketing |
| Role permissions | Staff → Role permissions |

---

## Deployment

The application is Vercel-compatible and equally happy on a VPS or in a
container.

**Any platform**

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET` (`openssl rand -base64 32`) and `NEXT_PUBLIC_APP_URL`.
3. Run migrations: `npm run prisma:deploy`.
4. Build and start: `npm run build && npm start`.
5. Sign in as the Super Admin, change the seeded password, and work through
   Settings.

**Vercel**

- Build command: `npm run build` (it runs `prisma generate` first).
- Add every environment variable from `.env.example` that you use.
- Use a pooled connection string if your provider offers one.

**Before going live**

- [ ] Change every seeded password.
- [ ] Set a fresh `AUTH_SECRET`.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the real domain.
- [ ] Turn on indexing in Settings → SEO once the catalogue is ready.
- [ ] Review Settings → Delivery & districts for your real charges.
- [ ] Replace the demo contact phone and email in Settings → Business settings.
- [ ] Confirm `.env` is not committed.

---

## Troubleshooting

**`SECURITY WARNING: The SSL modes 'prefer', 'require' and 'verify-ca'…`**
A deprecation notice from the `pg` driver, printed once at startup. It is not
an error and nothing is wrong with your setup — it warns that a future `pg`
release will change what `sslmode=require` means. If your `DATABASE_URL` ends
in `?sslmode=require`, change it to `?sslmode=verify-full` to keep today's
(stricter) behaviour explicitly. A local database with no `sslmode` at all is
unaffected.

**`Module not found: Can't resolve '@/generated/prisma/client'`**
The Prisma client is generated code, not checked in. `npm install` generates it
through the `postinstall` script; if you skipped that or deleted
`src/generated`, run `npm run prisma:generate`. Note that `next dev` does not
generate it — only `npm install` and `npm run build` do.

**`Can't reach database server`**
PostgreSQL is not running or `DATABASE_URL` is wrong. The build still succeeds —
this only affects runtime pages. Check with
`psql "$DATABASE_URL" -c 'select 1'`.

**`Environment variable not found: DATABASE_URL` from a Prisma command**
Prisma 7 does not auto-load `.env`; `prisma.config.ts` does it. Make sure `.env`
exists in the project root and you are running the command from there.

**Image upload says it is not configured**
Set the `CLOUDINARY_*` variables. Until then, paste an image URL into the field
below the upload button — every image field accepts one.

**The AI assistant replies with the fallback message**
No provider has a key. Set any one of `GEMINI_API_KEY`, `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY`. That is the intended unconfigured behaviour; the assistant
still returns matching products from the catalogue. Dashboard → Business
settings shows which providers are ready.

**"Send to courier" says the courier has no API credentials**
The courier's `Integration` is set to an adapter (Pathao, Steadfast, RedX) but
`COURIER_<CODE>_API_KEY` and `COURIER_<CODE>_BASE_URL` are not set. Either add
them, or set the courier's integration to *Manual* and use the **Enter
tracking** tab to record a parcel you created in the courier's own dashboard.
Dashboard → Courier shows the status of each one.

**Courier status callbacks are not arriving**
Check three things, in order. The courier's webhook URL must be
`https://your-domain.com/api/webhooks/courier/<CODE>` with the code exactly as
registered. `COURIER_<CODE>_WEBHOOK_SECRET` must be set — without it the
endpoint refuses every callback by design, because an unauthenticated endpoint
that can mark orders delivered is a way to steal stock. And the courier must be
active in Dashboard → Settings → Courier. Every attempt, accepted or refused,
appears in Dashboard → Courier → Dispatch log with the reason.

**Profit looks too high after recording settlements**
It should not, and if it does, check whether a settlement was entered as a
manual income line. A courier settlement is a *transfer*, not income — the sale
was already booked as revenue when the order was recognised, so recording the
cash arriving as income counts it twice. Automatic settlements post as
transfers; a manual line entered as "Money in" would not. Void it and let the
settlement panel on the order post it instead.

**Stock says "available" but a customer cannot order it**
Check the *reserved* column. Available is what is sellable now; reserved is
promised to orders that have not shipped. On hand is the two added together, so
a product can be physically present and still unsellable because it is spoken
for.

**A coupon is refused at checkout**
The reason is shown on the page: expired, not started, usage limit reached, not
applicable to the cart's products, below the minimum, or blocked because the
items are already on flash sale or discounted by an offer.

**Bengali text shows as `?` in a downloaded PDF**
Add a Unicode font — see [Bengali text in PDF invoices](#bengali-text-in-pdf-invoices).

**`npm test` skips the integration tests**
That is by design when no database is reachable. Run migrations and the seed to
include them.
# bismillah_house
