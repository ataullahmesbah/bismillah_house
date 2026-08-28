# Environment setup

Everything Trust Mart can connect to, what happens when you don't connect it,
and where to get each key.

**Two variables are required. Everything else is optional**, and the shop is
built so that a missing integration degrades to something sensible rather than
breaking a page. You can go live with just a database and a secret, then add
integrations one at a time.

```bash
cp .env.example .env       # then edit .env
```

Never commit `.env`. It is already in `.gitignore`.

---

## Required

| Variable | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Signs session material. Generate with `openssl rand -base64 32` |

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trustmart?schema=public"
AUTH_SECRET="paste-a-long-random-string-here"
```

Managed Postgres (Neon, Supabase, RDS) usually needs `?sslmode=require` on the
end of the URL.

### Required in production

```env
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXT_PUBLIC_TIMEZONE="Asia/Dhaka"
```

`NEXT_PUBLIC_APP_URL` is used for canonical URLs, the sitemap, Open Graph tags,
invoice footers and the OAuth callback. Getting it wrong mostly shows up as
Google sign-in failing and social previews pointing at localhost.

---

## Database migration

First install, or any time you pull new code:

```bash
npm install                 # runs `prisma generate` automatically
npx prisma migrate deploy   # applies migrations; never destructive
npm run db:seed             # optional: demo catalogue, districts, defaults
```

`migrate deploy` is the production-safe command — it applies pending migrations
and nothing else. Use `npm run prisma:migrate` (which is `migrate dev`) only in
development.

**`db:seed` is safe to re-run.** It upserts, and skips anything that already
exists — your products, orders, users and permissions are not touched. It adds
what is missing: districts, the default warehouse, the chart of accounts and
expense categories.

---

## Optional integrations

### Images — Cloudinary

```env
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
CLOUDINARY_UPLOAD_FOLDER="trust-mart"
```

**Without it:** upload buttons explain that uploads are not configured. You can
still paste image URLs by hand and every other feature works.
**Get it from:** the Cloudinary dashboard, after signing up free.

---

### AI — shopping assistant and product drafting

Set a key for **any one** of these and both AI features work.

```env
GEMINI_API_KEY=""       # https://aistudio.google.com/apikey
OPENAI_API_KEY=""       # https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=""    # https://console.anthropic.com/settings/keys
```

Set **several** and the shop falls through to the next when one fails or runs
out of quota — which is what you want on a free tier. Gemini has the most
generous free tier, so start there.

**Without any:** nothing breaks. The shopping assistant falls back to a plain
catalogue search, and AI product drafting stays hidden. Products are still
added by hand exactly as before.

Which provider is tried first, which model each uses, and whether product
drafting is on at all are set in **Dashboard → Business settings → AI**. Keys
never go in the database.

---

### Courier — automatic parcel creation and tracking

Credentials are read **per courier code**, so several couriers can be connected
at once. For a courier whose code is `PATHAO`:

```env
COURIER_PATHAO_BASE_URL=""
COURIER_PATHAO_API_KEY=""
COURIER_PATHAO_API_SECRET=""
COURIER_PATHAO_STORE_ID=""
COURIER_PATHAO_WEBHOOK_SECRET=""
```

Same pattern for `COURIER_STEADFAST_*` and `COURIER_REDX_*`. The unprefixed
`COURIER_*` variables act as a fallback when you use a single courier.

**Register the couriers themselves** in Dashboard → Settings → Courier, and set
each one's *Integration* to the matching adapter (Pathao, Steadfast, RedX, or
Manual).

**Then give the courier your webhook URL:**

```
https://your-domain.com/api/webhooks/courier/PATHAO
```

> **The webhook secret is not optional if you use webhooks.** Without it that
> endpoint refuses every callback. This is deliberate: an unauthenticated
> endpoint that can mark orders delivered is a way to steal stock.

**Without any of this:** staff enter tracking numbers by hand on the order
screen, and the timeline, settlements, and the customer's tracking page all
still work. You just open the courier's own dashboard to create the parcel.

---

### Payments

```env
BKASH_BASE_URL=""
BKASH_USERNAME=""
BKASH_PASSWORD=""
BKASH_APP_KEY=""
BKASH_APP_SECRET=""

SSLCOMMERZ_STORE_ID=""
SSLCOMMERZ_STORE_PASSWORD=""
SSLCOMMERZ_SANDBOX="true"
```

**Without them:** cash on delivery works fully. bKash can still be enabled in
Dashboard → Payments — the customer sends money to your merchant number and
enters the transaction ID, which staff verify on the order screen. That is how
most Bangladeshi shops actually operate, so this is a real mode, not a stub.

---

### Google sign-in

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://your-domain.com/api/auth/google/callback"
```

**Get it from:** console.cloud.google.com → APIs & Services → Credentials →
Create OAuth client ID (Web application). Register the redirect URI above as an
authorised redirect URI, exactly.

**Without it:** the Google buttons do not appear. Email and password sign-in is
unaffected.

The keys make Google sign-in *possible*; the switch in **Dashboard → Business
settings → Sign-in security** decides whether it is *on*.

---

### Cloudflare Turnstile — free bot check

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""
```

**Get it from:** dash.cloudflare.com → Turnstile → Add site. It is free with no
paid tier required.

Both keys are needed — the site key renders the widget, the secret verifies it
server-side. Verification happens in the server action, so hiding the widget is
never what stops a bot.

**Without them:** the check is skipped. Rate limiting still protects sign-in.

Turn it on, and choose whether it applies to sign-in, sign-up or both, in
**Dashboard → Business settings → Sign-in security**. Sign-up is where the bots
are, so protecting only that is a reasonable choice.

---

### SMS — checkout verification codes

```env
SMS_PROVIDER="none"
SMS_API_URL=""
SMS_API_KEY=""
SMS_SENDER_ID=""

# Field names the gateway expects; the defaults suit most BD providers.
SMS_TO_FIELD="to"
SMS_MESSAGE_FIELD="message"
SMS_API_KEY_FIELD="api_key"
SMS_SENDER_ID_FIELD="senderid"
```

Any Bangladeshi bulk-SMS provider works — point `SMS_API_URL` at their endpoint
and rename the field variables to match their documentation.

**Without it:** leave `SMS_PROVIDER="none"` and the "Verify mobile number at
checkout" feature stays off. The dashboard warns you rather than silently
blocking checkout.

---

### Analytics

```env
META_CAPI_ACCESS_TOKEN=""
```

GA4, GTM and Meta Pixel **IDs are not secrets** and are set in Dashboard →
Settings → Analytics, not here. Only the Meta Conversions API token belongs in
the environment.

---

### Other

```env
INVOICE_FONT_PATH=""                  # Unicode TTF for Bengali text in PDFs
SEED_SUPER_ADMIN_EMAIL="..."          # used by npm run db:seed
SEED_SUPER_ADMIN_PASSWORD="..."       # change before seeding anything public
RATE_LIMIT_ENABLED="true"             # "false" only for local load testing
SESSION_LIFETIME_DAYS="30"
```

---

## What is deliberately **not** in the environment

Anything a shop owner should be able to change without a deploy lives in the
database and is edited from the dashboard: shop name, logo, delivery charges
per district, payment instructions, feature switches, low-stock thresholds,
SEO defaults, navigation, homepage sections, and every AI/courier/finance
behaviour setting.

The rule is: **secrets in the environment, decisions in the dashboard.** A
database dump therefore contains no API keys.

---

## Verifying your setup

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm test              # unit + integration tests
npm run build         # production build
npm run start         # serve the production build
```

The build works without a database — it degrades to defaults rather than
failing — so a broken `DATABASE_URL` shows up at runtime, not at build time.

Signed in as the seeded Super Admin, these pages tell you what is connected:

| Page | Reports |
|---|---|
| Dashboard → Business settings | AI providers, Turnstile and Google key status |
| Dashboard → Settings → Courier | which couriers have credentials |
| Dashboard → Courier | integration status per courier |
| Dashboard → Products → AI drafting | which AI providers are ready |
