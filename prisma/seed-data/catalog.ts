import type { Art } from "./product-art";

/**
 * The demo catalogue.
 *
 * An empty shop cannot be judged. Every homepage section, the category grid,
 * the filters on /shop, the variant picker, the review block and the stock
 * badges all behave differently with real rows behind them, so this file fills
 * the catalogue with a believable Bangladeshi shop: electronics and gadget
 * accessories, footwear, t-shirts and genji, bags and wallets, groceries, rice,
 * dates and dry fruits.
 *
 * All of it is demo data, upserted with an empty `update` so re-running the
 * seed never overwrites something the owner has edited. Replace it from the
 * dashboard — this is a starting point, not a fixture anyone should ship.
 *
 * Prices are plain taka here (`price: 1200` means ৳1,200); the seed converts
 * them to the minor units the database stores.
 */

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                    */
/* -------------------------------------------------------------------------- */

export const CATALOG_ROOT_CATEGORIES = [
  { name: "Electronics", slug: "electronics", description: "Phones, audio, gadgets and the accessories that go with them.", featured: true },
] as const;

export const CATALOG_CHILD_CATEGORIES = [
  { name: "Mobile & Gadgets", slug: "mobile-gadgets", parent: "electronics" },
  { name: "Audio & Sound", slug: "audio", parent: "electronics" },
  { name: "Gadget Accessories", slug: "gadget-accessories", parent: "electronics" },
  { name: "Home Appliances", slug: "home-appliances", parent: "electronics" },
  { name: "Genji & Innerwear", slug: "genji-innerwear", parent: "fashion" },
  { name: "Panjabi", slug: "panjabi", parent: "fashion" },
  { name: "Bags & Wallets", slug: "bags-wallets", parent: "fashion" },
  { name: "Sneakers", slug: "sneakers", parent: "footwear" },
  { name: "Sandals & Slippers", slug: "sandals", parent: "footwear" },
  { name: "Cooking Oil", slug: "cooking-oil", parent: "groceries" },
  { name: "Spices & Masala", slug: "spices", parent: "groceries" },
  { name: "Tea & Beverages", slug: "tea-beverages", parent: "groceries" },
  { name: "Lentils & Pulses", slug: "lentils-pulses", parent: "groceries" },
] as const;

export const CATALOG_BRANDS = [
  { name: "Nexa", slug: "nexa" },
  { name: "SoundKit", slug: "soundkit" },
  { name: "UrbanStep", slug: "urbanstep" },
  { name: "Dhaka Denim", slug: "dhaka-denim" },
  { name: "Padma Foods", slug: "padma-foods" },
  { name: "Kori Leather", slug: "kori-leather" },
] as const;

/** Colours, sizes and capacities the new products need beyond the ones already seeded. */
export const CATALOG_ATTRIBUTE_OPTIONS = {
  colour: [
    ["navy", "Navy", "#1e3a5f"],
    ["grey", "Grey", "#6b7280"],
    ["green", "Green", "#15803d"],
    ["red", "Red", "#b91c1c"],
    ["maroon", "Maroon", "#7f1d1d"],
    ["beige", "Beige", "#d6c7a8"],
    ["silver", "Silver", "#cbd5e1"],
  ],
  size: [["xxl", "XXL"]],
  weight: [["5kg", "5kg"], ["25kg", "25kg"]],
  "shoe-size": [["40", "40"], ["41", "41"], ["42", "42"]],
} as const;

/** Battery capacity, which nothing seeded before this catalogue needed. */
export const CATALOG_ATTRIBUTES = [
  {
    name: "Capacity",
    slug: "capacity",
    type: "SELECT" as const,
    unit: "mAh",
    options: [["10000mah", "10,000 mAh"], ["20000mah", "20,000 mAh"]],
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

export type CatalogVariantRow = {
  options: string[];
  name: string;
  sku: string;
  /** Taka. */
  price: number;
  stock: number;
  compareAt?: number;
};

export type CatalogProduct = {
  name: string;
  slug: string;
  sku: string;
  category: string;
  brand?: string;
  short: string;
  description: string;
  /** Taka. */
  price: number;
  compareAt?: number;
  /** Left at 0 for products that carry variants — their stock rolls up. */
  stock: number;
  art: Art;
  /** Extra gallery images, usually the same product in another colour. */
  gallery?: Art[];
  tags: string[];
  specs: Array<{ label: string; value: string }>;
  featured?: boolean;
  topSelling?: boolean;
  /** Days ago it was "added", so New arrivals has a believable order. */
  addedDaysAgo?: number;
  review: { author: string; rating: number; title: string; body: string };
  variants?: { attributes: string[]; rows: CatalogVariantRow[] };
};

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  /* ===================== Electronics — mobile & gadgets ==================== */
  {
    name: "Nexa A17 Smartphone 6/128GB",
    slug: "nexa-a17-smartphone",
    sku: "TM-PH-A17",
    category: "mobile-gadgets",
    brand: "nexa",
    short: "6.6\" 120Hz display, 5000mAh battery, 50MP camera. Official warranty.",
    description:
      "A mid-range phone that does the things people actually complain about: the battery lasts a full day of heavy use, the 120Hz screen stays readable in daylight, and the 50MP main camera holds detail indoors without smearing faces. Dual SIM, 4G on both slots, and a headphone jack that has not been removed.",
    price: 18990,
    compareAt: 21500,
    stock: 0,
    art: { kind: "phone", color: "#1e293b", accent: "#0b1220" },
    gallery: [{ kind: "phone", color: "#1e3a5f", accent: "#0b1220" }],
    tags: ["smartphone", "mobile", "5000mah", "120hz"],
    specs: [
      { label: "Display", value: "6.6\" IPS, 120Hz" },
      { label: "Battery", value: "5000 mAh, 33W charging" },
      { label: "Camera", value: "50MP + 2MP, 16MP front" },
      { label: "Warranty", value: "1 year official" },
    ],
    featured: true,
    topSelling: true,
    addedDaysAgo: 3,
    review: {
      author: "Mahmudul H.",
      rating: 5,
      title: "Battery is the real story",
      body: "Two days of normal use on one charge. Screen is bright enough on a rickshaw at noon, which is more than I expected at this price.",
    },
    variants: {
      attributes: ["colour"],
      rows: [
        { options: ["colour:black"], name: "Midnight Black", sku: "TM-PH-A17-BLK", price: 18990, compareAt: 21500, stock: 14 },
        { options: ["colour:navy"], name: "Ocean Navy", sku: "TM-PH-A17-NVY", price: 18990, compareAt: 21500, stock: 9 },
      ],
    },
  },
  {
    name: "Nexa PowerCore Power Bank",
    slug: "nexa-powercore-power-bank",
    sku: "TM-PB-CORE",
    category: "mobile-gadgets",
    brand: "nexa",
    short: "Fast-charge power bank with USB-C in/out and a four-dot charge gauge.",
    description:
      "Charges a phone from flat in a little over an hour, and has enough left for a second go. USB-C carries power in both directions, so the same cable that charges the bank charges your phone. The four dots tell you what is left without guessing.",
    price: 1850,
    compareAt: 2400,
    stock: 0,
    art: { kind: "powerbank", color: "#1f2937", accent: "#38bdf8" },
    tags: ["power bank", "charger", "usb-c", "travel"],
    specs: [
      { label: "Capacity", value: "10,000 / 20,000 mAh" },
      { label: "Output", value: "22.5W PD" },
      { label: "Ports", value: "USB-C in/out, 2× USB-A" },
    ],
    topSelling: true,
    addedDaysAgo: 9,
    review: {
      author: "Sabbir R.",
      rating: 4,
      title: "Does what it says",
      body: "Charged my phone twice on a trip to Cox's Bazar. Slightly heavy in a pocket but that is the trade for the capacity.",
    },
    variants: {
      attributes: ["capacity"],
      rows: [
        { options: ["capacity:10000mah"], name: "10,000 mAh", sku: "TM-PB-CORE-10K", price: 1850, compareAt: 2400, stock: 30 },
        { options: ["capacity:20000mah"], name: "20,000 mAh", sku: "TM-PB-CORE-20K", price: 2950, compareAt: 3600, stock: 18 },
      ],
    },
  },
  {
    name: "Nexa Fit 2 Smart Watch",
    slug: "nexa-fit-2-smart-watch",
    sku: "TM-SW-FIT2",
    category: "mobile-gadgets",
    brand: "nexa",
    short: "Heart rate, SpO2 and sleep tracking with a seven-day battery.",
    description:
      "A fitness watch that survives a week between charges. Tracks heart rate continuously, blood oxygen on demand, and sleep stages overnight. Notifications mirror from the phone, and the strap is a standard 22mm so you can change it for anything.",
    price: 2790,
    compareAt: 3500,
    stock: 42,
    art: { kind: "smartwatch", color: "#0f172a", accent: "#0b1220" },
    gallery: [{ kind: "smartwatch", color: "#7f1d1d", accent: "#0b1220" }],
    tags: ["smart watch", "fitness", "heart rate", "gadget"],
    specs: [
      { label: "Display", value: "1.83\" TFT" },
      { label: "Battery", value: "7 days typical" },
      { label: "Water rating", value: "IP68" },
      { label: "Strap", value: "22mm, replaceable" },
    ],
    featured: true,
    addedDaysAgo: 5,
    review: {
      author: "Nusrat J.",
      rating: 5,
      title: "Sleep tracking actually works",
      body: "Wore it for two weeks. The step count matches my phone and it really does last a week. Strap is comfortable to sleep in.",
    },
  },

  /* ============================ Electronics — audio ======================== */
  {
    name: "SoundKit Air Pro Earbuds",
    slug: "soundkit-air-pro-earbuds",
    sku: "TM-EB-AIRPRO",
    category: "audio",
    brand: "soundkit",
    short: "True wireless earbuds with ENC calling and a 24-hour case.",
    description:
      "Environmental noise cancellation on the microphones, so people can hear you on a Dhaka street. Six hours in the buds, another eighteen in the case. Touch controls for play, skip and calls, and a low-latency mode for video.",
    price: 1690,
    compareAt: 2200,
    stock: 0,
    art: { kind: "earbuds", color: "#f8fafc", accent: "#334155" },
    gallery: [{ kind: "earbuds", color: "#1e293b", accent: "#64748b" }],
    tags: ["earbuds", "wireless", "bluetooth", "enc"],
    specs: [
      { label: "Playtime", value: "6h + 18h case" },
      { label: "Bluetooth", value: "5.3" },
      { label: "Mic", value: "ENC dual mic" },
      { label: "Charging", value: "USB-C" },
    ],
    featured: true,
    topSelling: true,
    addedDaysAgo: 2,
    review: {
      author: "Tanvir A.",
      rating: 4,
      title: "Calls are clear",
      body: "Used them on the road and the person on the other end could hear me over traffic. Bass is decent, not amazing — fine for the price.",
    },
    variants: {
      attributes: ["colour"],
      rows: [
        { options: ["colour:white"], name: "White", sku: "TM-EB-AIRPRO-WHT", price: 1690, compareAt: 2200, stock: 40 },
        { options: ["colour:black"], name: "Black", sku: "TM-EB-AIRPRO-BLK", price: 1690, compareAt: 2200, stock: 35 },
      ],
    },
  },
  {
    name: "SoundKit Studio 40 Headphones",
    slug: "soundkit-studio-40-headphones",
    sku: "TM-HP-ST40",
    category: "audio",
    brand: "soundkit",
    short: "Over-ear wireless headphones with 40mm drivers and a 40-hour battery.",
    description:
      "Padded over-ear cups that stay comfortable for a long session, 40mm drivers with a warm low end, and a battery that lasts most of a working week. Folds flat, and a 3.5mm cable is in the box for when it does run out.",
    price: 3450,
    compareAt: 4200,
    stock: 26,
    art: { kind: "headphone", color: "#111827", accent: "#374151" },
    gallery: [{ kind: "headphone", color: "#1e3a5f", accent: "#334155" }],
    tags: ["headphones", "over-ear", "wireless", "studio"],
    specs: [
      { label: "Drivers", value: "40mm dynamic" },
      { label: "Battery", value: "40 hours" },
      { label: "Wired", value: "3.5mm cable included" },
    ],
    addedDaysAgo: 14,
    review: {
      author: "Rafi K.",
      rating: 5,
      title: "Comfortable for long hours",
      body: "I wear these editing for four or five hours and my ears do not hurt. The fold-flat hinge fits my bag.",
    },
  },
  {
    name: "SoundKit Boom Mini Speaker",
    slug: "soundkit-boom-mini-speaker",
    sku: "TM-SP-BOOM",
    category: "audio",
    brand: "soundkit",
    short: "Splash-proof Bluetooth speaker with a passive bass radiator.",
    description:
      "Small enough for a bag, loud enough for a rooftop. A passive radiator gives it more low end than the size suggests, and IPX6 means a splash at a picnic is not a problem. Twelve hours a charge.",
    price: 1450,
    compareAt: 1900,
    stock: 38,
    art: { kind: "speaker", color: "#0f172a", accent: "#22d3ee" },
    tags: ["speaker", "bluetooth", "portable", "waterproof"],
    specs: [
      { label: "Output", value: "10W" },
      { label: "Battery", value: "12 hours" },
      { label: "Water rating", value: "IPX6" },
    ],
    addedDaysAgo: 20,
    review: {
      author: "Imran S.",
      rating: 4,
      title: "Good for the size",
      body: "Took it to a picnic and it filled the space. Bass is surprising for something this small.",
    },
  },

  /* ====================== Electronics — gadget accessories ================== */
  {
    name: "Nexa 33W Fast Charger",
    slug: "nexa-33w-fast-charger",
    sku: "TM-CH-33W",
    category: "gadget-accessories",
    brand: "nexa",
    short: "33W USB-C wall charger with over-current protection.",
    description:
      "A compact 33W charger that fills a modern phone to half in about twenty minutes. Over-current and over-temperature protection built in, and a folding pin so it does not tear a bag lining.",
    price: 690,
    compareAt: 950,
    stock: 120,
    art: { kind: "charger", color: "#f1f5f9", accent: "#94a3b8" },
    tags: ["charger", "fast charging", "usb-c", "accessory"],
    specs: [
      { label: "Output", value: "33W PD / QC" },
      { label: "Port", value: "USB-C" },
      { label: "Protection", value: "Over-current, over-temp" },
    ],
    addedDaysAgo: 25,
    review: {
      author: "Sadia I.",
      rating: 5,
      title: "Charges properly fast",
      body: "Half battery in twenty minutes, exactly as described. Small enough to leave in my bag.",
    },
  },
  {
    name: "Braided USB-C Cable 1.5m",
    slug: "braided-usb-c-cable",
    sku: "TM-CB-USBC",
    category: "gadget-accessories",
    brand: "nexa",
    short: "Nylon-braided 60W USB-C cable that survives being coiled daily.",
    description:
      "The cheap cables fray at the connector within months. This one has a nylon braid and a moulded strain relief, carries 60W, and comes in a length that actually reaches from a socket to a bed.",
    price: 320,
    compareAt: 450,
    stock: 0,
    art: { kind: "cable", color: "#e2e8f0", accent: "#334155" },
    gallery: [{ kind: "cable", color: "#334155", accent: "#0f172a" }],
    tags: ["cable", "usb-c", "braided", "accessory"],
    specs: [
      { label: "Length", value: "1.5 m" },
      { label: "Power", value: "60W" },
      { label: "Jacket", value: "Nylon braid" },
    ],
    addedDaysAgo: 30,
    review: {
      author: "Arif H.",
      rating: 4,
      title: "Feels sturdy",
      body: "Been using it three months, no fraying at the ends yet. That already beats the last two I bought.",
    },
    variants: {
      attributes: ["colour"],
      rows: [
        { options: ["colour:grey"], name: "Grey", sku: "TM-CB-USBC-GRY", price: 320, compareAt: 450, stock: 80 },
        { options: ["colour:black"], name: "Black", sku: "TM-CB-USBC-BLK", price: 320, compareAt: 450, stock: 65 },
      ],
    },
  },
  {
    name: "Nexa Silent Wireless Mouse",
    slug: "nexa-silent-wireless-mouse",
    sku: "TM-MS-SIL",
    category: "gadget-accessories",
    brand: "nexa",
    short: "Silent-click 2.4GHz mouse with a one-year battery.",
    description:
      "The click is muted rather than removed, so you still feel it without waking anyone. 1600 DPI, a nano receiver that lives in the base, and a single AA that lasts about a year of daily work.",
    price: 550,
    compareAt: 750,
    stock: 64,
    art: { kind: "mouse", color: "#111827", accent: "#60a5fa" },
    tags: ["mouse", "wireless", "silent", "office"],
    specs: [
      { label: "Connection", value: "2.4GHz nano receiver" },
      { label: "DPI", value: "1600" },
      { label: "Battery", value: "1× AA, ~12 months" },
    ],
    addedDaysAgo: 34,
    review: {
      author: "Farhana A.",
      rating: 5,
      title: "Genuinely quiet",
      body: "I work at night next to a sleeping baby. This was the point of buying it and it delivers.",
    },
  },
  {
    name: "Nexa Slim Wireless Keyboard",
    slug: "nexa-slim-wireless-keyboard",
    sku: "TM-KB-SLIM",
    category: "gadget-accessories",
    brand: "nexa",
    short: "Low-profile wireless keyboard with scissor switches.",
    description:
      "Scissor-switch keys with a short, definite travel — closer to a laptop than a membrane board. Full number pad, two-degree tilt feet, and the same nano receiver as the mouse so one dongle runs both.",
    price: 1250,
    compareAt: 1600,
    stock: 30,
    art: { kind: "keyboard", color: "#1e293b", accent: "#60a5fa" },
    tags: ["keyboard", "wireless", "slim", "office"],
    specs: [
      { label: "Switches", value: "Scissor, low profile" },
      { label: "Layout", value: "Full size with numpad" },
      { label: "Battery", value: "2× AAA" },
    ],
    addedDaysAgo: 40,
    review: {
      author: "Shakil M.",
      rating: 4,
      title: "Types like a laptop",
      body: "If you like laptop keyboards you will like this. Number pad is useful for accounts work.",
    },
  },
  {
    name: "Nexa LED Smart Bulb 9W",
    slug: "nexa-led-smart-bulb",
    sku: "TM-BL-9W",
    category: "home-appliances",
    brand: "nexa",
    short: "Warm-to-cool dimmable LED bulb, controlled from the phone.",
    description:
      "Screws into a standard holder and shifts from warm yellow to daylight white from an app or a voice assistant. Nine watts for the light of an old sixty-watt bulb, which is where the electricity bill improves.",
    price: 480,
    compareAt: 650,
    stock: 90,
    art: { kind: "bulb", color: "#e2e8f0", accent: "#94a3b8" },
    tags: ["bulb", "led", "smart home", "energy saving"],
    specs: [
      { label: "Power", value: "9W (≈60W equivalent)" },
      { label: "Base", value: "E27" },
      { label: "Colour", value: "2700K – 6500K, dimmable" },
    ],
    addedDaysAgo: 46,
    review: {
      author: "Rumana K.",
      rating: 4,
      title: "Nice warm light",
      body: "Setting it up took five minutes. I keep it warm in the evening and daylight when I am working.",
    },
  },

  /* ============================== Footwear ================================= */
  {
    name: "UrbanStep Runner Sneakers",
    slug: "urbanstep-runner-sneakers",
    sku: "TM-SN-RUN",
    category: "sneakers",
    brand: "urbanstep",
    short: "Lightweight mesh running shoes with a cushioned EVA midsole.",
    description:
      "Breathable mesh upper for the heat, an EVA midsole with real cushioning under the heel, and a rubber outsole with a tread that grips wet tiles. Light enough that you forget you are wearing them.",
    price: 2450,
    compareAt: 3200,
    stock: 0,
    art: { kind: "sneaker", color: "#e2e8f0", accent: "#1e293b" },
    gallery: [{ kind: "sneaker", color: "#1e293b", accent: "#e2e8f0" }],
    tags: ["sneakers", "running", "sports", "men"],
    specs: [
      { label: "Upper", value: "Breathable mesh" },
      { label: "Midsole", value: "EVA cushioned" },
      { label: "Outsole", value: "Rubber, wet grip" },
    ],
    featured: true,
    topSelling: true,
    addedDaysAgo: 6,
    review: {
      author: "Jubayer R.",
      rating: 5,
      title: "Light and grippy",
      body: "Walked ten thousand steps a day in these for a month. No blisters, and they do not slip on wet floors.",
    },
    variants: {
      attributes: ["shoe-size", "colour"],
      rows: [
        { options: ["shoe-size:40", "colour:white"], name: "40 / White", sku: "TM-SN-RUN-40-WHT", price: 2450, compareAt: 3200, stock: 8 },
        { options: ["shoe-size:41", "colour:white"], name: "41 / White", sku: "TM-SN-RUN-41-WHT", price: 2450, compareAt: 3200, stock: 12 },
        { options: ["shoe-size:42", "colour:white"], name: "42 / White", sku: "TM-SN-RUN-42-WHT", price: 2450, compareAt: 3200, stock: 10 },
        { options: ["shoe-size:41", "colour:black"], name: "41 / Black", sku: "TM-SN-RUN-41-BLK", price: 2450, compareAt: 3200, stock: 9 },
        { options: ["shoe-size:42", "colour:black"], name: "42 / Black", sku: "TM-SN-RUN-42-BLK", price: 2450, compareAt: 3200, stock: 7 },
        { options: ["shoe-size:43", "colour:black"], name: "43 / Black", sku: "TM-SN-RUN-43-BLK", price: 2550, compareAt: 3300, stock: 5 },
      ],
    },
  },
  {
    name: "Kori Formal Leather Loafers",
    slug: "kori-formal-leather-loafers",
    sku: "TM-LF-FORM",
    category: "mens-shoes",
    brand: "kori-leather",
    short: "Slip-on leather loafers with a leather-lined footbed.",
    description:
      "Proper slip-ons for office wear: full-grain upper, leather lining that breathes instead of trapping sweat, and a stitched sole that a cobbler can actually repair rather than replace.",
    price: 2650,
    compareAt: 3400,
    stock: 0,
    art: { kind: "loafer", color: "#111827", accent: "#4b2e18" },
    gallery: [{ kind: "loafer", color: "#5b3a1f", accent: "#3f2415" }],
    tags: ["loafers", "formal", "leather", "office"],
    specs: [
      { label: "Upper", value: "Full-grain leather" },
      { label: "Lining", value: "Leather" },
      { label: "Sole", value: "Stitched, repairable" },
    ],
    addedDaysAgo: 18,
    review: {
      author: "Aminul I.",
      rating: 4,
      title: "Smart without being stiff",
      body: "Wore them straight to a wedding with no breaking in. The leather lining makes a difference in this weather.",
    },
    variants: {
      attributes: ["shoe-size", "colour"],
      rows: [
        { options: ["shoe-size:41", "colour:black"], name: "41 / Black", sku: "TM-LF-41-BLK", price: 2650, compareAt: 3400, stock: 6 },
        { options: ["shoe-size:42", "colour:black"], name: "42 / Black", sku: "TM-LF-42-BLK", price: 2650, compareAt: 3400, stock: 8 },
        { options: ["shoe-size:43", "colour:black"], name: "43 / Black", sku: "TM-LF-43-BLK", price: 2750, compareAt: 3500, stock: 5 },
        { options: ["shoe-size:42", "colour:brown"], name: "42 / Brown", sku: "TM-LF-42-BRN", price: 2650, compareAt: 3400, stock: 4 },
        { options: ["shoe-size:43", "colour:brown"], name: "43 / Brown", sku: "TM-LF-43-BRN", price: 2750, compareAt: 3500, stock: 3 },
      ],
    },
  },
  {
    name: "UrbanStep Everyday Sandals",
    slug: "urbanstep-everyday-sandals",
    sku: "TM-SD-EVD",
    category: "sandals",
    brand: "urbanstep",
    short: "Contoured EVA sandals with a non-slip sole.",
    description:
      "A contoured footbed that supports the arch instead of leaving it flat, and a textured sole that holds on a wet bathroom floor. Rinse them under a tap and they are clean.",
    price: 590,
    compareAt: 800,
    stock: 0,
    art: { kind: "sandal", color: "#1f2937", accent: "#374151" },
    gallery: [{ kind: "sandal", color: "#78350f", accent: "#92400e" }],
    tags: ["sandals", "slippers", "everyday", "waterproof"],
    specs: [
      { label: "Material", value: "EVA" },
      { label: "Sole", value: "Non-slip textured" },
      { label: "Care", value: "Rinse and air dry" },
    ],
    topSelling: true,
    addedDaysAgo: 11,
    review: {
      author: "Hasib M.",
      rating: 4,
      title: "Comfortable at home",
      body: "Light and they do not slip in the bathroom, which is what I wanted. The arch shape is better than flat ones.",
    },
    variants: {
      attributes: ["shoe-size", "colour"],
      rows: [
        { options: ["shoe-size:41", "colour:black"], name: "41 / Black", sku: "TM-SD-41-BLK", price: 590, compareAt: 800, stock: 20 },
        { options: ["shoe-size:42", "colour:black"], name: "42 / Black", sku: "TM-SD-42-BLK", price: 590, compareAt: 800, stock: 24 },
        { options: ["shoe-size:43", "colour:black"], name: "43 / Black", sku: "TM-SD-43-BLK", price: 590, compareAt: 800, stock: 16 },
        { options: ["shoe-size:42", "colour:brown"], name: "42 / Brown", sku: "TM-SD-42-BRN", price: 590, compareAt: 800, stock: 14 },
      ],
    },
  },

  /* =============================== Fashion ================================= */
  {
    name: "Dhaka Denim Premium Polo",
    slug: "dhaka-denim-premium-polo",
    sku: "TM-PL-PREM",
    category: "t-shirts",
    brand: "dhaka-denim",
    short: "220 GSM pique polo with a collar that keeps its shape.",
    description:
      "Heavier than the usual polo at 220 GSM, in a pique knit that breathes. The collar is interlined so it stands up after washing rather than curling at the points — the thing that ruins most polos by the third wash.",
    price: 890,
    compareAt: 1200,
    stock: 0,
    art: { kind: "polo", color: "#0f766e", accent: "#f8fafc" },
    gallery: [{ kind: "polo", color: "#1e3a5f", accent: "#f8fafc" }, { kind: "polo", color: "#7f1d1d", accent: "#f8fafc" }],
    tags: ["polo", "cotton", "men", "casual"],
    specs: [
      { label: "Fabric", value: "220 GSM pique cotton" },
      { label: "Collar", value: "Interlined, ribbed" },
      { label: "Fit", value: "Regular" },
    ],
    featured: true,
    addedDaysAgo: 8,
    review: {
      author: "Nayeem C.",
      rating: 5,
      title: "Collar still stands",
      body: "Six washes in and the collar has not gone floppy. That is the only thing I care about in a polo.",
    },
    variants: {
      attributes: ["size", "colour"],
      rows: [
        { options: ["size:m", "colour:green"], name: "M / Green", sku: "TM-PL-M-GRN", price: 890, compareAt: 1200, stock: 18 },
        { options: ["size:l", "colour:green"], name: "L / Green", sku: "TM-PL-L-GRN", price: 890, compareAt: 1200, stock: 22 },
        { options: ["size:xl", "colour:green"], name: "XL / Green", sku: "TM-PL-XL-GRN", price: 940, compareAt: 1250, stock: 12 },
        { options: ["size:m", "colour:navy"], name: "M / Navy", sku: "TM-PL-M-NVY", price: 890, compareAt: 1200, stock: 16 },
        { options: ["size:l", "colour:navy"], name: "L / Navy", sku: "TM-PL-L-NVY", price: 890, compareAt: 1200, stock: 20 },
        { options: ["size:l", "colour:maroon"], name: "L / Maroon", sku: "TM-PL-L-MRN", price: 890, compareAt: 1200, stock: 9 },
      ],
    },
  },
  {
    name: "Dhaka Denim Oversized Tee",
    slug: "dhaka-denim-oversized-tee",
    sku: "TM-TS-OVER",
    category: "t-shirts",
    brand: "dhaka-denim",
    short: "Drop-shoulder oversized tee in 200 GSM cotton.",
    description:
      "A relaxed drop-shoulder cut in heavier 200 GSM cotton, so it hangs properly instead of clinging. Pre-shrunk, which means the size you buy is the size it stays.",
    price: 750,
    compareAt: 990,
    stock: 0,
    art: { kind: "tshirt", color: "#334155", accent: "#94a3b8" },
    gallery: [{ kind: "tshirt", color: "#d6c7a8", accent: "#94a3b8" }],
    tags: ["t-shirt", "oversized", "streetwear", "cotton"],
    specs: [
      { label: "Fabric", value: "200 GSM cotton" },
      { label: "Fit", value: "Oversized, drop shoulder" },
      { label: "Care", value: "Pre-shrunk, machine wash" },
    ],
    addedDaysAgo: 4,
    review: {
      author: "Samiul K.",
      rating: 4,
      title: "Hangs well",
      body: "Proper oversized fit, not just a bigger size. Washed twice and it has not shrunk.",
    },
    variants: {
      attributes: ["size", "colour"],
      rows: [
        { options: ["size:m", "colour:grey"], name: "M / Grey", sku: "TM-TS-OVER-M-GRY", price: 750, compareAt: 990, stock: 15 },
        { options: ["size:l", "colour:grey"], name: "L / Grey", sku: "TM-TS-OVER-L-GRY", price: 750, compareAt: 990, stock: 18 },
        { options: ["size:xl", "colour:grey"], name: "XL / Grey", sku: "TM-TS-OVER-XL-GRY", price: 800, compareAt: 1050, stock: 10 },
        { options: ["size:l", "colour:beige"], name: "L / Beige", sku: "TM-TS-OVER-L-BGE", price: 750, compareAt: 990, stock: 12 },
      ],
    },
  },
  {
    name: "Cotton Genji — Pack of 3",
    slug: "cotton-genji-pack-of-3",
    sku: "TM-GJ-PK3",
    category: "genji-innerwear",
    brand: "dhaka-denim",
    short: "Three combed-cotton sleeveless genji, cut long enough to stay tucked.",
    description:
      "The everyday sleeveless vest, done properly: combed cotton that stays soft after repeated washing, flat-lock seams that do not rub under the arm, and a longer body so it stays tucked in when you sit down.",
    price: 690,
    compareAt: 900,
    stock: 0,
    art: { kind: "genji", color: "#f8fafc", accent: "#cbd5e1" },
    gallery: [{ kind: "genji", color: "#1e293b", accent: "#475569" }],
    tags: ["genji", "vest", "innerwear", "cotton", "pack"],
    specs: [
      { label: "Fabric", value: "Combed cotton, 160 GSM" },
      { label: "Pack", value: "3 pieces" },
      { label: "Seams", value: "Flat-lock" },
    ],
    topSelling: true,
    addedDaysAgo: 16,
    review: {
      author: "Rakib H.",
      rating: 5,
      title: "Soft and long enough",
      body: "The length is the thing — it stays tucked. Bought a second pack for my brother.",
    },
    variants: {
      attributes: ["size", "colour"],
      rows: [
        { options: ["size:m", "colour:white"], name: "M / White", sku: "TM-GJ-M-WHT", price: 690, compareAt: 900, stock: 30 },
        { options: ["size:l", "colour:white"], name: "L / White", sku: "TM-GJ-L-WHT", price: 690, compareAt: 900, stock: 34 },
        { options: ["size:xl", "colour:white"], name: "XL / White", sku: "TM-GJ-XL-WHT", price: 740, compareAt: 950, stock: 20 },
        { options: ["size:l", "colour:black"], name: "L / Black", sku: "TM-GJ-L-BLK", price: 690, compareAt: 900, stock: 18 },
      ],
    },
  },
  {
    name: "Dhaka Denim Cotton Panjabi",
    slug: "dhaka-denim-cotton-panjabi",
    sku: "TM-PJ-COT",
    category: "panjabi",
    brand: "dhaka-denim",
    short: "Full-sleeve cotton panjabi with a hand-finished placket.",
    description:
      "A plain cotton panjabi for Eid and Friday prayers. The placket is hand-finished so the stitching stays straight, and the fabric is a mid-weight cotton that holds a press without being hot.",
    price: 1690,
    compareAt: 2200,
    stock: 0,
    art: { kind: "panjabi", color: "#f8fafc", accent: "#b45309" },
    gallery: [{ kind: "panjabi", color: "#1e3a5f", accent: "#cbd5e1" }, { kind: "panjabi", color: "#d6c7a8", accent: "#7f1d1d" }],
    tags: ["panjabi", "eid", "cotton", "traditional"],
    specs: [
      { label: "Fabric", value: "Mid-weight cotton" },
      { label: "Sleeve", value: "Full" },
      { label: "Placket", value: "Hand-finished" },
    ],
    featured: true,
    addedDaysAgo: 7,
    review: {
      author: "Mizanur R.",
      rating: 5,
      title: "Bought it for Eid",
      body: "The cotton is comfortable in the heat and the stitching is neat. Ordered the navy one after.",
    },
    variants: {
      attributes: ["size", "colour"],
      rows: [
        { options: ["size:m", "colour:white"], name: "M / White", sku: "TM-PJ-M-WHT", price: 1690, compareAt: 2200, stock: 12 },
        { options: ["size:l", "colour:white"], name: "L / White", sku: "TM-PJ-L-WHT", price: 1690, compareAt: 2200, stock: 15 },
        { options: ["size:xl", "colour:white"], name: "XL / White", sku: "TM-PJ-XL-WHT", price: 1790, compareAt: 2300, stock: 8 },
        { options: ["size:l", "colour:navy"], name: "L / Navy", sku: "TM-PJ-L-NVY", price: 1690, compareAt: 2200, stock: 10 },
      ],
    },
  },
  {
    name: "Kori Leather Money Bag",
    slug: "kori-leather-money-bag",
    sku: "TM-WL-MONEY",
    category: "bags-wallets",
    brand: "kori-leather",
    short: "Bi-fold leather wallet with six card slots and a note compartment.",
    description:
      "Full-grain leather that darkens with use rather than peeling. Six card slots, a long note compartment sized for taka, and a hidden pocket behind it. Stitched, not glued, so the edges do not open up.",
    price: 1150,
    compareAt: 1600,
    stock: 0,
    art: { kind: "wallet", color: "#5b3a1f", accent: "#c8a96a" },
    gallery: [{ kind: "wallet", color: "#111827", accent: "#6b7280" }],
    tags: ["wallet", "money bag", "leather", "men"],
    specs: [
      { label: "Material", value: "Full-grain leather" },
      { label: "Slots", value: "6 cards + note compartment" },
      { label: "Construction", value: "Stitched" },
    ],
    featured: true,
    topSelling: true,
    addedDaysAgo: 12,
    review: {
      author: "Kamrul A.",
      rating: 5,
      title: "Real leather, real stitching",
      body: "You can smell the difference from the plastic ones. Fits taka notes without folding them twice.",
    },
    variants: {
      attributes: ["colour"],
      rows: [
        { options: ["colour:brown"], name: "Brown", sku: "TM-WL-BRN", price: 1150, compareAt: 1600, stock: 22 },
        { options: ["colour:black"], name: "Black", sku: "TM-WL-BLK", price: 1150, compareAt: 1600, stock: 26 },
      ],
    },
  },
  {
    name: "Kori Everyday Backpack 22L",
    slug: "kori-everyday-backpack",
    sku: "TM-BP-22L",
    category: "bags-wallets",
    brand: "kori-leather",
    short: "22-litre backpack with a padded 15\" laptop sleeve and a rain cover.",
    description:
      "Water-resistant fabric, a padded sleeve that takes a 15-inch laptop, and a rain cover tucked into the base — which matters here more than anywhere. Padded straps and a back panel that lets some air through.",
    price: 1890,
    compareAt: 2500,
    stock: 34,
    art: { kind: "backpack", color: "#1e3a5f", accent: "#f59e0b" },
    gallery: [{ kind: "backpack", color: "#111827", accent: "#94a3b8" }],
    tags: ["backpack", "laptop bag", "college", "travel"],
    specs: [
      { label: "Capacity", value: "22 litres" },
      { label: "Laptop", value: "Fits up to 15\"" },
      { label: "Extras", value: "Rain cover included" },
    ],
    addedDaysAgo: 22,
    review: {
      author: "Tahmid S.",
      rating: 4,
      title: "Rain cover saved my laptop",
      body: "Caught in a downpour on the way to class. Everything inside stayed dry. Straps are comfortable when it is full.",
    },
  },
  {
    name: "Kori Reversible Leather Belt",
    slug: "kori-reversible-leather-belt",
    sku: "TM-BT-REV",
    category: "bags-wallets",
    brand: "kori-leather",
    short: "One belt, two colours — the buckle turns.",
    description:
      "Black on one side, brown on the other, with a buckle that rotates so you carry one belt instead of two. Cut from a single strip of leather rather than bonded scraps, which is why it will not crack across the middle.",
    price: 780,
    compareAt: 1050,
    stock: 48,
    art: { kind: "belt", color: "#3f2415", accent: "#cbd5e1" },
    tags: ["belt", "leather", "reversible", "men"],
    specs: [
      { label: "Material", value: "Single-strip leather" },
      { label: "Width", value: "35 mm" },
      { label: "Sizes", value: "Trim to fit, 32–42" },
    ],
    addedDaysAgo: 28,
    review: {
      author: "Sohel R.",
      rating: 4,
      title: "Two belts in one",
      body: "Flips easily and the leather is thick. Had to trim it to size which was straightforward.",
    },
  },
  {
    name: "Trust Select Cotton Cap",
    slug: "trust-select-cotton-cap",
    sku: "TM-CP-COT",
    category: "fashion",
    brand: "trust-select",
    short: "Six-panel cotton cap with an adjustable metal buckle.",
    description:
      "Plain six-panel cap in washed cotton, with brass eyelets and an adjustable strap rather than plastic snaps. The brim holds its curve.",
    price: 390,
    compareAt: 550,
    stock: 0,
    art: { kind: "cap", color: "#b91c1c", accent: "#f8fafc" },
    gallery: [{ kind: "cap", color: "#1e293b", accent: "#f8fafc" }],
    tags: ["cap", "hat", "cotton", "casual"],
    specs: [
      { label: "Material", value: "Washed cotton" },
      { label: "Closure", value: "Adjustable metal buckle" },
    ],
    addedDaysAgo: 36,
    review: {
      author: "Riad H.",
      rating: 4,
      title: "Good everyday cap",
      body: "Brim keeps its shape and the buckle is metal, not plastic. Fits my head properly.",
    },
    variants: {
      attributes: ["colour"],
      rows: [
        { options: ["colour:red"], name: "Red", sku: "TM-CP-RED", price: 390, compareAt: 550, stock: 25 },
        { options: ["colour:black"], name: "Black", sku: "TM-CP-BLK", price: 390, compareAt: 550, stock: 30 },
        { options: ["colour:navy"], name: "Navy", sku: "TM-CP-NVY", price: 390, compareAt: 550, stock: 18 },
      ],
    },
  },

  /* ============================== Groceries ================================ */
  {
    name: "Medjool Dates 1kg",
    slug: "medjool-dates-1kg",
    sku: "TM-DT-MED",
    category: "dates-dry-fruits",
    brand: "ajwa-gardens",
    short: "Large, soft Medjool dates — the sweet ones, sold by the kilo.",
    description:
      "Grade-one Medjool: big, soft and caramel-sweet, with skin that has not dried and split. Packed in a sealed box so they arrive in the condition they left, not stuck to each other in a bag.",
    price: 1250,
    compareAt: 1600,
    stock: 55,
    art: { kind: "dates", color: "#8b5e34", accent: "#c8a96a" },
    tags: ["dates", "medjool", "dry fruits", "ramadan"],
    specs: [
      { label: "Grade", value: "Jumbo, grade one" },
      { label: "Weight", value: "1 kg sealed box" },
      { label: "Storage", value: "Cool, dry place" },
    ],
    featured: true,
    addedDaysAgo: 10,
    review: {
      author: "Ayesha S.",
      rating: 5,
      title: "Big and genuinely soft",
      body: "Bought these instead of the loose ones from the market. Worth the difference — none of them were dried out.",
    },
  },
  {
    name: "Mixed Nuts & Dry Fruits 500g",
    slug: "mixed-nuts-dry-fruits-500g",
    sku: "TM-DF-MIX",
    category: "dates-dry-fruits",
    brand: "padma-foods",
    short: "Almonds, cashews, pistachios, raisins and apricot in one jar.",
    description:
      "An unsalted mix in a sealed jar: almonds, cashews, pistachios, raisins and dried apricot. Nothing roasted in oil, nothing coated in sugar — so it keeps, and so you can cook with it as well as snack on it.",
    price: 780,
    compareAt: 1000,
    stock: 70,
    art: { kind: "spice", color: "#b45309", accent: "#78350f" },
    tags: ["dry fruits", "nuts", "almonds", "cashew", "healthy"],
    specs: [
      { label: "Weight", value: "500 g" },
      { label: "Contains", value: "Almond, cashew, pistachio, raisin, apricot" },
      { label: "Added", value: "No salt, no sugar, no oil" },
    ],
    addedDaysAgo: 24,
    review: {
      author: "Nabila T.",
      rating: 4,
      title: "Good mix, fresh",
      body: "Nuts were crisp, not stale. I use it for both snacking and desserts.",
    },
  },
  {
    name: "Chinigura Aromatic Rice 5kg",
    slug: "chinigura-aromatic-rice-5kg",
    sku: "TM-RC-CHG5",
    category: "rice-grains",
    brand: "padma-foods",
    short: "Small-grain Chinigura — the polau rice, aged and cleaned.",
    description:
      "Aged Chinigura with the short, fragrant grain that polau and biryani need. Cleaned and stone-free, so it does not need three washes before it goes in the pot.",
    price: 850,
    compareAt: 1050,
    stock: 0,
    art: { kind: "rice", color: "#c8a96a", accent: "#7c6a45" },
    tags: ["rice", "chinigura", "polau", "biryani", "aromatic"],
    specs: [
      { label: "Type", value: "Chinigura, aged" },
      { label: "Grain", value: "Short, aromatic" },
      { label: "Cleaning", value: "Stone-free, machine cleaned" },
    ],
    topSelling: true,
    addedDaysAgo: 15,
    review: {
      author: "Shirin A.",
      rating: 5,
      title: "Smells right",
      body: "Made polau for guests and the aroma filled the flat. No stones, which saves a wash.",
    },
    variants: {
      attributes: ["weight"],
      rows: [
        { options: ["weight:1kg"], name: "1 kg", sku: "TM-RC-CHG-1", price: 190, compareAt: 230, stock: 60 },
        { options: ["weight:5kg"], name: "5 kg", sku: "TM-RC-CHG-5", price: 850, compareAt: 1050, stock: 40 },
      ],
    },
  },
  {
    name: "Miniket Rice 25kg Sack",
    slug: "miniket-rice-25kg",
    sku: "TM-RC-MNK25",
    category: "rice-grains",
    brand: "padma-foods",
    short: "A month's rice for a family — 25kg of clean Miniket.",
    description:
      "The everyday rice, bought the way most families actually buy it: a full sack. Machine cleaned and sieved, delivered to the door so nobody has to carry twenty-five kilos up the stairs from the market.",
    price: 1980,
    compareAt: 2300,
    stock: 25,
    art: { kind: "rice", color: "#e8dcc0", accent: "#8b7355" },
    tags: ["rice", "miniket", "sack", "family pack", "bulk"],
    specs: [
      { label: "Weight", value: "25 kg sack" },
      { label: "Type", value: "Miniket" },
      { label: "Delivery", value: "Carried to your door" },
    ],
    addedDaysAgo: 32,
    review: {
      author: "Jahangir A.",
      rating: 5,
      title: "Delivered up three floors",
      body: "This is why I ordered online instead of the bazar. Rice quality is the same as I usually buy.",
    },
  },
  {
    name: "Pure Soybean Oil 5L",
    slug: "pure-soybean-oil-5l",
    sku: "TM-OL-SOY5",
    category: "cooking-oil",
    brand: "padma-foods",
    short: "Fortified soybean oil in a 5-litre bottle with a handle.",
    description:
      "Vitamin A fortified soybean oil for everyday cooking, in the 5-litre bottle with a moulded handle. Sealed cap with a tamper ring, and a batch date printed rather than stickered on.",
    price: 890,
    compareAt: 1020,
    stock: 60,
    art: { kind: "oil", color: "#c9a227", accent: "#166534" },
    tags: ["oil", "soybean", "cooking", "fortified"],
    specs: [
      { label: "Volume", value: "5 litres" },
      { label: "Fortified", value: "Vitamin A" },
      { label: "Seal", value: "Tamper-evident cap" },
    ],
    topSelling: true,
    addedDaysAgo: 26,
    review: {
      author: "Rehana B.",
      rating: 4,
      title: "Sealed properly",
      body: "Arrived with the seal intact and no leaking, which is the risk with 5 litres. Price was better than the shop.",
    },
  },
  {
    name: "Whole Garam Masala 200g",
    slug: "whole-garam-masala-200g",
    sku: "TM-SP-GRM",
    category: "spices",
    brand: "padma-foods",
    short: "Whole cardamom, cinnamon, clove and bay — not ground, not blended.",
    description:
      "Whole spices in a sealed jar so the oils stay in them: green cardamom, cinnamon bark, clove and bay leaf. Grind what you need. Ground masala loses most of its aroma within weeks of opening, which is why this is sold whole.",
    price: 340,
    compareAt: 450,
    stock: 85,
    art: { kind: "spice", color: "#78350f", accent: "#b45309" },
    tags: ["spice", "garam masala", "whole spice", "cooking"],
    specs: [
      { label: "Weight", value: "200 g" },
      { label: "Contains", value: "Cardamom, cinnamon, clove, bay" },
      { label: "Form", value: "Whole" },
    ],
    addedDaysAgo: 38,
    review: {
      author: "Fatema K.",
      rating: 5,
      title: "Aroma is strong",
      body: "You can tell it is fresh the moment you open the jar. I grind small amounts as needed.",
    },
  },
  {
    name: "Turmeric Powder 500g",
    slug: "turmeric-powder-500g",
    sku: "TM-SP-TUR",
    category: "spices",
    brand: "padma-foods",
    short: "Pure ground turmeric, lab tested for colour adulterants.",
    description:
      "Ground turmeric with nothing added. Adulteration with metanil yellow is a real problem in loose turmeric, so every batch here is tested for it and the report number is printed on the pack.",
    price: 220,
    compareAt: 300,
    stock: 95,
    art: { kind: "spice", color: "#d97706", accent: "#92400e" },
    tags: ["turmeric", "holud", "spice", "tested"],
    specs: [
      { label: "Weight", value: "500 g" },
      { label: "Testing", value: "Batch tested for metanil yellow" },
      { label: "Added", value: "Nothing" },
    ],
    addedDaysAgo: 42,
    review: {
      author: "Lutfa R.",
      rating: 5,
      title: "Colour and smell are right",
      body: "Deep colour without that chemical brightness. Good that they test it and print the batch.",
    },
  },
  {
    name: "Premium Black Tea 400g",
    slug: "premium-black-tea-400g",
    sku: "TM-TE-BLK",
    category: "tea-beverages",
    brand: "padma-foods",
    short: "Strong Sylhet black tea that takes milk without disappearing.",
    description:
      "A blend from Sylhet gardens, cut for strength rather than delicacy — it holds up to milk and sugar the way tea is actually drunk here. Foil-lined pack so it does not go flat halfway through.",
    price: 420,
    compareAt: 550,
    stock: 78,
    art: { kind: "tea", color: "#166534", accent: "#f59e0b" },
    tags: ["tea", "black tea", "sylhet", "cha"],
    specs: [
      { label: "Weight", value: "400 g" },
      { label: "Origin", value: "Sylhet" },
      { label: "Pack", value: "Foil lined" },
    ],
    featured: true,
    addedDaysAgo: 19,
    review: {
      author: "Habib U.",
      rating: 5,
      title: "Proper strong cha",
      body: "Takes milk without turning into coloured water. This is what I want in the morning.",
    },
  },
  {
    name: "Masoor Dal 1kg",
    slug: "masoor-dal-1kg",
    sku: "TM-LN-MSR",
    category: "lentils-pulses",
    brand: "padma-foods",
    short: "Sorted red lentils — cleaned, uniform, cooks evenly.",
    description:
      "Machine sorted so the grains are the same size and cook at the same rate, which is the difference between dal and half-raw dal. Cleaned of stones and husk before packing.",
    price: 145,
    compareAt: 180,
    stock: 110,
    art: { kind: "lentil", color: "#c2410c", accent: "#ea580c" },
    tags: ["dal", "masoor", "lentils", "daily"],
    specs: [
      { label: "Weight", value: "1 kg" },
      { label: "Sorting", value: "Machine sorted, uniform grain" },
      { label: "Cleaning", value: "Stone and husk free" },
    ],
    topSelling: true,
    addedDaysAgo: 44,
    review: {
      author: "Salma B.",
      rating: 4,
      title: "Cooks evenly",
      body: "No half-cooked grains and no stones. That is all I ask of dal.",
    },
  },
  {
    name: "Chola Boot (Chickpeas) 1kg",
    slug: "chola-boot-chickpeas-1kg",
    sku: "TM-LN-CHL",
    category: "lentils-pulses",
    brand: "padma-foods",
    short: "Whole chickpeas, sorted and cleaned — for iftar and everyday.",
    description:
      "Whole chola, sorted for size so they soften together rather than some staying hard. Cleaned and packed dry, and sold in the kilo size most households actually use in a week of Ramadan.",
    price: 165,
    compareAt: 210,
    stock: 88,
    art: { kind: "lentil", color: "#d6c7a8", accent: "#b45309" },
    tags: ["chola", "chickpeas", "boot", "iftar", "ramadan"],
    specs: [
      { label: "Weight", value: "1 kg" },
      { label: "Type", value: "Whole, desi" },
      { label: "Sorting", value: "Size sorted" },
    ],
    addedDaysAgo: 48,
    review: {
      author: "Anwar H.",
      rating: 4,
      title: "Softened evenly",
      body: "Soaked overnight and they all cooked at the same rate. Used them through Ramadan.",
    },
  },

  /* ============================ Home & kitchen ============================= */
  {
    name: "Non-Stick Frying Pan 26cm",
    slug: "non-stick-frying-pan-26cm",
    sku: "TM-KT-PAN26",
    category: "kitchen",
    brand: "trust-select",
    short: "26cm pan with a three-layer non-stick coating and a stay-cool handle.",
    description:
      "A three-layer coating that survives a metal spoon better than the single-layer pans, on a thick base that spreads heat instead of burning a ring in the middle. The handle stays cool and is riveted, not screwed.",
    price: 1290,
    compareAt: 1700,
    stock: 45,
    art: { kind: "cookware", color: "#94a3b8", accent: "#1f2937" },
    tags: ["pan", "non-stick", "kitchen", "cookware"],
    specs: [
      { label: "Diameter", value: "26 cm" },
      { label: "Coating", value: "3-layer non-stick" },
      { label: "Handle", value: "Riveted, stay-cool" },
    ],
    addedDaysAgo: 29,
    review: {
      author: "Mitu A.",
      rating: 4,
      title: "Eggs slide right off",
      body: "Heats evenly and nothing sticks. The handle really does stay cool on gas.",
    },
  },
  {
    name: "Electric Kettle 1.8L",
    slug: "electric-kettle-1-8l",
    sku: "TM-KT-EK18",
    category: "home-appliances",
    brand: "nexa",
    short: "1.8L stainless kettle that switches itself off at the boil.",
    description:
      "Boils 1.8 litres in about five minutes and shuts off by itself, with a second cut-out if it is ever switched on dry. Stainless inside — no plastic touching hot water — and a water window so you are not guessing.",
    price: 1590,
    compareAt: 2100,
    stock: 40,
    art: { kind: "kettle", color: "#64748b", accent: "#1f2937" },
    tags: ["kettle", "electric", "kitchen", "appliance"],
    specs: [
      { label: "Capacity", value: "1.8 litres" },
      { label: "Power", value: "1500W" },
      { label: "Safety", value: "Auto shut-off, dry-boil cut-out" },
    ],
    featured: true,
    addedDaysAgo: 13,
    review: {
      author: "Parvez M.",
      rating: 5,
      title: "Fast and safe",
      body: "Boils quickly and turns itself off. Stainless inside was the reason I picked this one.",
    },
  },
  {
    name: "Insulated Steel Water Bottle 1L",
    slug: "insulated-steel-water-bottle-1l",
    sku: "TM-BT-INS1",
    category: "kitchen",
    brand: "trust-select",
    short: "Double-walled steel bottle — cold for 24 hours, hot for 12.",
    description:
      "Vacuum-insulated stainless steel: ice water stays cold all day in this heat, and tea stays hot through a shift. The mouth is wide enough to get ice cubes and a brush inside.",
    price: 890,
    compareAt: 1200,
    stock: 0,
    art: { kind: "bottle", color: "#0ea5e9", accent: "#0f172a" },
    gallery: [{ kind: "bottle", color: "#15803d", accent: "#0f172a" }],
    tags: ["bottle", "insulated", "steel", "water"],
    specs: [
      { label: "Capacity", value: "1 litre" },
      { label: "Insulation", value: "24h cold / 12h hot" },
      { label: "Material", value: "304 stainless steel" },
    ],
    addedDaysAgo: 21,
    review: {
      author: "Sumaiya R.",
      rating: 5,
      title: "Still cold at night",
      body: "Filled it with ice water in the morning and it was still cold when I got home. Wide mouth is easy to clean.",
    },
    variants: {
      attributes: ["colour"],
      rows: [
        { options: ["colour:blue"], name: "Blue", sku: "TM-BT-INS-BLU", price: 890, compareAt: 1200, stock: 28 },
        { options: ["colour:green"], name: "Green", sku: "TM-BT-INS-GRN", price: 890, compareAt: 1200, stock: 22 },
        { options: ["colour:silver"], name: "Silver", sku: "TM-BT-INS-SLV", price: 940, compareAt: 1250, stock: 18 },
      ],
    },
  },
];
