# What changed in this release

Everything below is in the ZIP, migrated, tested and building. Read
[`ENV_SETUP.md`](ENV_SETUP.md) for keys and [`README.md`](README.md) for how the
system fits together.

---

## 1. Inventory

Stock used to be one number. It is now three, because "we have two" and "two are
sellable" are different answers:

| | Meaning |
|---|---|
| **Available** | Sellable this second |
| **Reserved** | Promised to orders that have not shipped |
| **On hand** | Available + reserved |

Eleven screens under **Inventory**: Overview, Products stock, Variants stock,
Low stock, Out of stock, Adjustments, Movements, Incoming, Returns, Warehouses,
Reports.

- **Adjustments** — stock received, damaged, lost, returned, expired, manual
  correction, inventory count correction, warehouse transfer. The reason fixes
  the direction, so a damage write-off cannot add stock. Each one records who,
  when, previous stock, change, new stock and the reason.
- **Warehouses** — balances are summed from the movement ledger, not stored. A
  duplicated counter is one forgotten write path away from disagreeing with
  itself permanently.
- **Incoming** — supplier shipments count as *arriving*, never as sellable,
  until received. Suppliers short-ship, so receiving records what actually
  turned up and leaves the rest outstanding.
- **Reports** — stock value at cost and retail, 30-day movement by type, best
  sellers and their cover, and CSV downloads.

Orders drive it automatically: placing reserves, shipping consumes the
reservation, cancelling or returning releases it. It is released exactly once —
a parcel that ships and comes back does not release twice.

## 2. Courier

**You no longer open the courier's dashboard.** On a confirmed order, *Send to
courier* creates the parcel in their system and brings the tracking number back.

- Adapters for Pathao, Steadfast and RedX behind one interface, plus a manual
  mode for couriers with no API — which refuses loudly rather than showing a
  button that will fail.
- Webhooks sync status: created, pickup pending, picked, in transit, at hub, at
  destination, out for delivery, delivered, hold, failed, returned, cancelled.
- The parcel's journey — status, location, previous locations, pickup date,
  expected delivery, rider details where the courier sends them — shown to staff
  on the order and to the customer on their order page and the public tracking
  page.
- **Settlements** post into the books. Order value, courier charge, collected,
  settled, and status, all against the order. No reconciling two systems by eye.
- Every call is logged with its outcome, so "I pressed send and nothing
  happened" has an answer. Failures can be retried, and tracking can always be
  entered by hand.

## 3. Accounts & finance

A full set of books, not an order report.

Overview · Transactions · Expenses · Profit & loss · Cash flow · Accounts ·
Categories, with CSV export throughout.

- Categories a Bangladeshi shop actually uses: salary, bonus, gifts, staff food,
  travel, packaging, courier charges, marketing, office, internet, software,
  website maintenance, purchases.
- Cash, bank, mobile wallet and courier-receivable accounts. Balances are
  derived, never a stored running total.
- Orders post their own revenue, cost of goods, packaging and courier charge —
  at placement or at delivery, your choice (default delivery, because cash on
  delivery is not money until it arrives).
- **Nothing is ever deleted.** A wrong entry is voided with a reason, and every
  edit keeps a revision.

## 4. AI

Gemini, OpenAI and Claude behind one interface, with fallback between them —
set several keys and a spent free tier moves on to the next.

**Product drafting**: describe a product, the AI writes name, slug, SKU,
descriptions, specifications, SEO fields, category and brand suggestions, tags,
attributes, variant suggestions and an image prompt. You review it, change what
you disagree with, and it is created **unpublished**. The AI never puts anything
live.

The prompt tells the model to leave a field blank rather than guess, and shows
its own uncertainty at the top of the review screen. With no key configured the
assistant falls back to a catalogue search and drafting hides itself — manual
product entry is unaffected.

## 5. Storefront

- **Cart drawer** — slides in from the right with images, variants, quantity
  controls, remove, totals, and View cart / Checkout / Continue shopping. Closes
  on Escape and on tapping outside.
- **Mobile menu** — sections collapse instead of all expanding at once, which
  used to push the account buttons off the bottom of the screen.
- **Notifications on mobile** — the panel no longer runs off the left edge.
- **Hero buttons** — both come from the banner. A button needs a label *and* a
  link; with neither set the row is not rendered, so there is no empty gap.
- **Shop by category** — square cards instead of circular crops, two columns on
  the narrowest phones.

## 6. Sign-in security

Cloudflare Turnstile and Google sign-in each get a dashboard switch, enforced on
the server — the captcha is re-checked inside the action, and the OAuth route
refuses when the switch is off. Sign-in and sign-up are separate switches, since
sign-up is where the bots are.

The settings page reports whether the keys behind each switch are present.

## 7. Checkout access

"Allow guest checkout" and "Require login for checkout" could contradict each
other, and the combination that read as *guests welcome* actually sent everyone
to the login page. They are now one question — **Who can check out?** — with two
answers.

---

## What you need to do

```bash
npm install
npx prisma migrate deploy
npm run db:seed        # safe on a live shop; see below
npm run build
npm start
```

**`db:seed` will not touch your data.** Verified against a shop with real rows:
edited prices and descriptions kept, a suspended-and-demoted account left
suspended and demoted, a rewritten policy page intact, and your own products,
users and orders untouched. It only fills in what is missing — this release adds
a default warehouse, the chart of accounts and four new settings groups.

### Optional keys

Nothing below is required. See `ENV_SETUP.md` for where to get each one.

| Add | To get |
|---|---|
| `GEMINI_API_KEY` (or OpenAI / Anthropic) | AI assistant and product drafting |
| `COURIER_<CODE>_*` incl. `WEBHOOK_SECRET` | Automatic parcel creation and status sync |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | The bot check |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Continue with Google |

### Manual configuration

1. **Settings → Sign-in security** — turn on Turnstile and Google once their
   keys are in.
2. **Settings → Courier** — set each courier's *Integration*, then give the
   courier your webhook URL: `https://your-domain.com/api/webhooks/courier/<CODE>`.
3. **Settings → Inventory & finance** — alert levels, when a sale counts as
   revenue, packaging cost per order.
4. **Settings → AI** — provider order, models, and whether product drafting is on.
5. **Inventory → Warehouses** — rename "Main store", or add more sites.
6. **Staff & roles** — the new permissions (inventory, courier, finance, AI)
   have sensible defaults; adjust if your team is shaped differently.

---

## Testing summary

| | Result |
|---|---|
| Unit + integration tests | **194 passing** |
| Lint | clean |
| TypeScript | clean |
| Production build | clean |
| Migrations | applied, additive only |
| Responsive sweep | **280 page renders** across 320/375/390/430/768/1024/1440/1920 as anonymous, staff and customer — no horizontal overflow, no error status |
| Dashboard pages | all 27 new pages render, no runtime errors |
| Export permissions | anonymous 401, customer 403, moderator 200 without cost columns, owner 200 with them |
| Courier webhook | signature verification, tampering, missing secret, unknown status and unknown provider all covered |

### Real problems found and fixed while verifying

- **Cost prices leaked in the inventory CSV.** A moderator may see stock counts
  but not what things cost. The page hid those columns; the export did not.
- **Courier settlements double-counted revenue.** The sale is booked at
  delivery; posting the settlement as income counted it again. It is a transfer
  now, and profit is unaffected.
- **The cart drawer's buttons swallowed clicks.** `backdrop-blur` on the header
  made it the containing block for the drawer's `fixed` positioning, collapsing
  the panel to header height so the footer covered the items.
- **The seed reverted owner edits.** Re-running it reactivated a suspended
  account, reset demo product prices, and replaced rewritten policy pages.
- **Long code strings scrolled the page sideways** on the courier settings page
  at 320px.

---

## Known limitations

- **Courier adapters are written to each provider's published API shape but have
  not been run against a live merchant account.** The field mappings are the
  part most likely to need a small adjustment on first connection; the dispatch
  log shows the exact request and response when one does.
- **AI product drafting has not been run against a live API key** in this
  environment. The parser is tested against the malformed output models
  actually produce (code fences, prose before the JSON, numbers as strings,
  wrong types), but real provider responses may need prompt tuning.
- **Image generation is a prompt, not a generated image.** The draft gives you a
  prompt to paste into an image generator; nothing is uploaded automatically.
- **Warehouse balances are informational.** Stock is deducted from a single
  pool at checkout, not from a specific warehouse — multi-warehouse allocation
  would need a picking strategy, which is a larger change.
- **`.xlsx` is not generated directly.** Exports are CSV with a UTF-8 byte-order
  mark, which Excel, Google Sheets and LibreOffice all open correctly, including
  Bangla product names.
- **Bulk SMS is still provider-agnostic scaffolding** — point `SMS_API_URL` at a
  Bangladeshi gateway and rename the field variables to match their docs.
