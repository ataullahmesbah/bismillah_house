# Demo catalogue — products, images, reviews, variants

আপনার shop-টা ফাঁকা ছিল, তাই পুরো catalogue-টা demo data দিয়ে ভরে দেওয়া হয়েছে —
banner থেকে শুরু করে Shop by category, Flash Sale, Featured, Top selling,
New arrivals এবং `/shop` — সব section-এ এখন product আছে।

সবটাই **demo**. Dashboard থেকে যেকোনো product edit বা delete করতে পারবেন,
এবং seed আবার চালালেও আপনার edit **নষ্ট হবে না** (`update: {}` — seed শুধু নতুন
row বানায়, পুরনোটা ছোঁয় না)।

---

## 1. কী কী আছে

| জিনিস | সংখ্যা |
|---|---|
| Products | 43 |
| Categories | 25 (6 root + 19 sub) |
| Brands | 10 |
| Variants (size / colour / weight / volume / pack) | 51 |
| Reviews (প্রতি product-এ ১টা, approved) | 43 |
| Flash sale items | 8 |
| Banners | 6 (৩টায় ছবি আছে) |
| Demo images (PNG) | 112 |

**Categories:** Electronics (Mobile & Gadgets, Audio & Sound, Gadget
Accessories, Home Appliances), Groceries (Dates & Dry Fruits, Rice & Grains,
Cooking Oil, Spices & Masala, Tea & Beverages, Lentils & Pulses, Honey &
Spreads), Fashion (T-Shirts, Genji & Innerwear, Panjabi, Bags & Wallets),
Footwear (Sneakers, Men's Shoes, Sandals & Slippers), Home & Living (Kitchen),
Health & Beauty.

আপনি যা যা চেয়েছিলেন — electronics, shoes, t-shirt, genji, money bag,
electronic items, gadget accessories, groceries, dates & dry, fashion, rice —
সবগুলোর product আছে। Money bag = **Kori Leather Money Bag**
(`/product/kori-leather-money-bag`), ৩টা রঙে।

প্রতিটা product-এ আছে: ছবি (variant অনুযায়ী একাধিক), short description, full
description, specifications table, tags, price + compare-at price, stock,
এবং একটা করে লেখা customer review.

---

## 2. ছবি কোথা থেকে আসছে

কোনো external image service ব্যবহার করা হয়নি — internet না থাকলেও shop ভরা
দেখাবে। ছবিগুলো seed চালানোর সময় **আঁকা হয়** এবং `public/demo/`-তে PNG হিসেবে
লেখা হয়:

- `prisma/seed-data/product-art.ts` — ৩৬ রকম product আঁকার code (phone, sneaker,
  genji, wallet, rice bag, honey jar, …)। প্রতিটা shape-এ gradient body, সাদা
  highlight আর নিচে contact shadow আছে — এজন্য flat vector-টা আসল আলো-পড়া
  জিনিসের মতো দেখায়, grey box-এর মতো না।
- `prisma/seed-data/demo-images.ts` — কোন ছবি লাগবে সেটা জমা রাখে, শেষে `sharp`
  দিয়ে PNG লিখে দেয়।

Colour আলাদা হলে ছবিও আলাদা — কালো আর সাদা t-shirt দুটো আলাদা ছবি।

**নিজের আসল ছবি বসানোর সময়:** Dashboard → Products → (product) → Images-এ
upload করুন। `public/demo/`-র PNG গুলো তখন মুছে দিতে পারবেন।

---

## 3. ফাইলগুলো কোথায় বসবে

Zip-টা project root-এ খুলবেন (`trust_mart/` folder-এ), path গুলো ঠিক রেখে।

### নতুন ফাইল

| ফাইল | কী করে |
|---|---|
| `prisma/seed-data/catalog.ts` | ৩৫টা নতুন product, তাদের category, brand, variant, review — পুরো catalogue এখানে |
| `prisma/seed-data/product-art.ts` | product আঁকার shape library + banner scene generator |
| `public/demo/*.png` (১১২টা) | আঁকা ছবিগুলো |

### বদলানো ফাইল

| ফাইল | কী বদলেছে |
|---|---|
| `prisma/seed.ts` | catalogue wire করা, প্রতি product-এ review, flash sale-এ ৮টা item, nav-এ Electronics + নতুন sub-category, attribute option-এর order ঠিক করা |
| `prisma/seed-data/demo-images.ts` | আঁকা ছবি আর banner scene support |
| `src/lib/services/home.ts` | homepage-এর category tile-এ sub-category-র product-ও গোনা হয় |
| `src/app/(shop)/page.tsx` | ঐ নতুন count-টা দেখানো |

---

## 4. Terminal-এ কী চালাবেন

Zip খোলার পরে, project folder-এ:

```bash
npm install
npx prisma generate
npx tsx prisma/seed.ts
npm run build
npm start
```

`npx tsx prisma/seed.ts` — এটাই আসল command. এটা করে:

1. category / brand / attribute / product / variant / review database-এ ঢোকায়
2. `public/demo/`-তে ছবিগুলো এঁকে ফেলে (যেগুলো আগে থেকে আছে সেগুলো আবার আঁকে না)

**কোনো migration লাগবে না** — schema-তে কিছু বদলায়নি, শুধু data ঢুকছে।

Development-এ চালাতে চাইলে শেষ দুই লাইনের বদলে:

```bash
npm run dev
```

### আবার চালালে কী হয়

`npx tsx prisma/seed.ts` যতবার খুশি চালাতে পারবেন — safe:

- যে product আগে থেকে আছে সেটা **skip** হয় (আপনার edit করা দাম / লেখা ফিরে যাবে না)
- review duplicate হয় না
- flash sale-এর সময় শেষ হয়ে গেলে সেটা আবার ৩ দিনের জন্য চালু হয় (তা না হলে
  homepage-এ Flash Sale section-টা ফাঁকা দেখাত)

---

## 5. আপনার product যোগ করার সময়

দুইভাবে পারবেন।

**Dashboard থেকে (সহজ):** Dashboard → Products → New product. Variant লাগলে
product-এর Variants tab-এ attribute (Colour / Size / Shoe Size / Weight /
Volume / Pack) বেছে row বানান।

**Seed file-এ লিখে (একসাথে অনেকগুলো):** `prisma/seed-data/catalog.ts`-এ
`CATALOG_PRODUCTS` array-তে একটা entry যোগ করুন —

```ts
{
  name: "আপনার product",
  slug: "apnar-product",          // unique
  sku: "TM-XX-001",               // unique
  category: "mobile-gadgets",     // category-র slug
  brand: "nexa",                  // optional
  short: "এক লাইনের বর্ণনা",
  description: "বড় বর্ণনা।",
  price: 1200,                    // সাধারণ টাকা, seed নিজে minor unit করে নেয়
  compareAt: 1600,
  stock: 25,
  art: { kind: "phone", color: "#111827" },   // ছবি
  tags: ["tag1", "tag2"],
  specs: [{ label: "Warranty", value: "1 year" }],
  featured: true,                 // Featured products section-এ দেখাবে
  topSelling: true,               // Top selling section-এ
  addedDaysAgo: 2,                // New arrivals-এ উপরে থাকবে
  review: { author: "নাম", rating: 5, title: "শিরোনাম", body: "মন্তব্য।" },
}
```

তারপর `npx tsx prisma/seed.ts`.

`art.kind`-এ যা যা দিতে পারবেন: `tshirt, polo, genji, panjabi, hoodie, shoe,
sneaker, sandal, loafer, phone, earbuds, headphone, smartwatch, powerbank,
charger, cable, mouse, keyboard, speaker, bulb, wallet, backpack, belt, cap,
rice, dates, honey, oil, spice, tea, lentil, sugar, cookware, kettle, bottle,
facewash`.

---

## 6. Homepage section গুলো কীভাবে ভরে

| Section | কোথা থেকে আসে |
|---|---|
| Hero banner | `banners` table, placement `HOME_HERO` — Dashboard → Banners |
| Shop by category | root category গুলো, `isFeatured` অনুযায়ী |
| Flash Sale | `flash_sales` + `flash_sale_items` — Dashboard → Offers |
| Featured products | product-এর `isFeatured` |
| Top selling | product-এর `isTopSelling` |
| New arrivals | `publishedAt` সবচেয়ে নতুন |

Homepage-এ কোন section কোথায় বসবে সেটা `home_sections` table-এ, Dashboard থেকে
বদলানো যায়।

---

## 7. এই round-এ যে ৪টা bug ধরা পড়েছে ও ঠিক করা হয়েছে

Demo data ঢোকানোর পরেই এগুলো চোখে পড়ল — data ছাড়া এগুলো দেখাই যেত না:

1. **Category tile-এ "0 items"** — Electronics-এ ১২টা product, কিন্তু tile-এ
   লেখা ছিল ০। কারণ product গুলো sub-category-তে থাকে, parent-এ না। এখন
   sub-category-র product-ও গোনা হয় (`src/lib/services/home.ts`)।
2. **Flash Sale section একেবারেই দেখাত না** — seed-এর flash sale-টা পুরনো,
   সময় শেষ হয়ে যাওয়া। এখন সময় শেষ হলে seed সেটা আবার চালু করে দেয়।
3. **Shoe size picker-এ order উল্টাপাল্টা (40, 43, 41, 42)** — নতুন size গুলো
   পুরনোগুলোর সাথে position-এ ধাক্কা খাচ্ছিল। এখন seed position-ও update করে।
4. **Menu-তে Electronics ছিল না** — navigation seed-এ যোগ করা হয়েছে, সাথে নতুন
   sub-category গুলোও।
5. **Variant-ওয়ালা product-এ ভুল discount** — Chinigura Rice-এ "-82% off" দেখাচ্ছিল।
   কারণ product-এর দাম সবচেয়ে সস্তা variant (1kg, ৳190) থেকে নিচ্ছিল কিন্তু
   compare-at price 5kg-এর (৳1,050) থেকে। এখন দুটোই **একই variant** থেকে আসে
   (`prisma/seed.ts`, `seedVariants`) — আপনি নতুন variant যোগ করলেও ঠিক থাকবে।

একটা জিনিস ইচ্ছে করেই এভাবে রাখা: flash sale item তৈরির সময় Prisma-র
`skipDuplicates` ভরসা করা যায় না, কারণ unique index-এ `variantId` আছে আর
Postgres দুটো NULL-কে আলাদা ধরে — তাই আগে থেকে থাকা product গুলো হাতে বাদ
দেওয়া হয়।
