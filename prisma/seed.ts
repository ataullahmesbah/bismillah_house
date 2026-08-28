/**
 * TRUST MART — development seed
 * ============================================================================
 * Creates a complete, realistic shop you can click through immediately:
 * roles and permissions, staff and demo customers, all 64 delivery districts,
 * catalogue with real variant examples from the PRD, coupons, an offer, a flash
 * sale, banners, homepage sections, policy pages, FAQ, navigation and a couple
 * of demo orders.
 *
 * Safe to re-run — everything is upserted by a natural key.
 *
 * The demo passwords below are for LOCAL DEVELOPMENT ONLY. Change them (or set
 * SEED_SUPER_ADMIN_PASSWORD) before this touches anything public.
 */

import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { BANGLADESH_DISTRICTS } from "./seed-data/districts";
import { SEED_FAQS, SEED_PAGES } from "./seed-data/content";
import { demoImage, isDemoImage, renderDemoImages } from "./seed-data/demo-images";

for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const taka = (amount: number) => Math.round(amount * 100);
const hash = (plain: string) => bcrypt.hash(plain, 10);

/** Demo credentials — local development only. */
const DEMO = {
  superAdmin: {
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@trustmart.local",
    password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin#2026",
    name: "Trust Mart Owner",
    phone: "01700000001",
  },
  admin: { email: "admin@trustmart.local", password: "Admin#2026", name: "Ayesha Rahman", phone: "01700000002" },
  moderator: { email: "moderator@trustmart.local", password: "Moderator#2026", name: "Rakib Hasan", phone: "01700000003" },
  customer: { email: "customer@trustmart.local", password: "Customer#2026", name: "Nusrat Jahan", phone: "01812345678" },
  customer2: { email: "customer2@trustmart.local", password: "Customer#2026", name: "Imran Kabir", phone: "01912345678" },
};

// Rendered into public/demo by renderDemoImages() once seeding finishes, so a
// seeded shop needs no network to look complete.
const PLACEHOLDER = (seed: string, size = 800) => demoImage(seed, size);

/* ========================================================================== */

async function seedPermissions() {
  const { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = await import("../src/lib/constants");

  await prisma.rolePermission.deleteMany({});
  await prisma.rolePermission.createMany({
    data: [
      ...DEFAULT_ROLE_PERMISSIONS.ADMIN.map((permission) => ({ role: "ADMIN" as const, permission, allowed: true })),
      ...DEFAULT_ROLE_PERMISSIONS.MODERATOR.map((permission) => ({ role: "MODERATOR" as const, permission, allowed: true })),
    ],
    skipDuplicates: true,
  });

  console.log(`  ✓ role permissions (${ALL_PERMISSIONS.length} available)`);
}

async function seedUsers() {
  const entries = [
    { ...DEMO.superAdmin, role: "SUPER_ADMIN" as const },
    { ...DEMO.admin, role: "ADMIN" as const },
    { ...DEMO.moderator, role: "MODERATOR" as const },
    { ...DEMO.customer, role: "CUSTOMER" as const },
    { ...DEMO.customer2, role: "CUSTOMER" as const },
  ];

  const users: Record<string, string> = {};
  for (const entry of entries) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      create: {
        email: entry.email,
        name: entry.name,
        phone: entry.phone,
        role: entry.role,
        status: "ACTIVE",
        passwordHash: await hash(entry.password),
        emailVerifiedAt: new Date(),
      },
      // Deliberately empty. Re-running the seed must not reactivate an account
      // an owner suspended, nor restore a role they demoted.
      update: {},
      select: { id: true, email: true },
    });
    users[entry.email] = user.id;
  }

  console.log(`  ✓ ${entries.length} users`);
  return users;
}

async function seedDistricts() {
  // Dhaka ৳60, every other district ৳120 — the PRD's worked example.
  for (const [index, district] of BANGLADESH_DISTRICTS.entries()) {
    const isDhaka = district.name === "Dhaka";
    await prisma.district.upsert({
      where: { name: district.name },
      create: {
        name: district.name,
        nameBn: district.nameBn,
        division: district.division,
        deliveryCharge: isDhaka ? taka(60) : taka(120),
        estimatedDays: isDhaka ? "1-2" : "2-4",
        isActive: true,
        position: index,
      },
      update: { nameBn: district.nameBn, division: district.division },
    });
  }

  // Two overrides that demonstrate the per-district rules.
  await prisma.district.update({ where: { name: "Sylhet" }, data: { isFreeDelivery: true } });
  await prisma.district.update({ where: { name: "Chattogram" }, data: { deliveryCharge: taka(100) } });

  console.log(`  ✓ ${BANGLADESH_DISTRICTS.length} districts (Dhaka ৳60, others ৳120, Sylhet free, Chattogram ৳100)`);
}

async function seedSettings(superAdminId: string) {
  const { SETTINGS_DEFAULTS } = await import("../src/lib/settings-defaults");

  const groups: Array<[string, object]> = [
    ["site", { ...SETTINGS_DEFAULTS.site }],
    ["contact", { ...SETTINGS_DEFAULTS.contact }],
    ["social", { ...SETTINGS_DEFAULTS.social, facebook: "https://facebook.com/", youtube: "https://youtube.com/" }],
    ["features", { ...SETTINGS_DEFAULTS.features }],
    ["theme", { ...SETTINGS_DEFAULTS.theme }],
    ["seo", { ...SETTINGS_DEFAULTS.seo }],
    ["analytics", { ...SETTINGS_DEFAULTS.analytics }],
    ["shipping", { ...SETTINGS_DEFAULTS.shipping, defaultCharge: taka(120) }],
    ["payment", { ...SETTINGS_DEFAULTS.payment }],
    ["ai", { ...SETTINGS_DEFAULTS.ai }],
    ["inventory", { ...SETTINGS_DEFAULTS.inventory }],
    ["courier", { ...SETTINGS_DEFAULTS.courier }],
    ["finance", { ...SETTINGS_DEFAULTS.finance }],
    ["security", { ...SETTINGS_DEFAULTS.security }],
    ["upload", { ...SETTINGS_DEFAULTS.upload }],
  ];

  for (const [key, value] of groups) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, group: key, value, updatedById: superAdminId },
      update: {},
    });
  }

  console.log(`  ✓ ${groups.length} settings groups`);
}

async function seedCategories() {
  const roots = [
    { name: "Groceries", slug: "groceries", description: "Everyday food and pantry essentials.", featured: true },
    { name: "Footwear", slug: "footwear", description: "Shoes and sandals for every day.", featured: true },
    { name: "Fashion", slug: "fashion", description: "Clothing and accessories.", featured: true },
    { name: "Home & Living", slug: "home-living", description: "Household and kitchen essentials.", featured: true },
    { name: "Health & Beauty", slug: "health-beauty", description: "Personal care and wellness.", featured: false },
  ];

  const ids: Record<string, string> = {};
  for (const [index, category] of roots.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: PLACEHOLDER(category.name, 400),
        position: index,
        isActive: true,
        showInMenu: true,
        isFeatured: category.featured,
        seoTitle: `${category.name} — buy online in Bangladesh`,
        seoDescription: category.description,
      },
      update: {},
      select: { id: true },
    });
    ids[category.slug] = row.id;
  }

  const children = [
    { name: "Dates & Dry Fruits", slug: "dates-dry-fruits", parent: "groceries" },
    { name: "Honey & Spreads", slug: "honey-spreads", parent: "groceries" },
    { name: "Rice & Grains", slug: "rice-grains", parent: "groceries" },
    { name: "Men's Shoes", slug: "mens-shoes", parent: "footwear" },
    { name: "T-Shirts", slug: "t-shirts", parent: "fashion" },
    { name: "Kitchen", slug: "kitchen", parent: "home-living" },
  ];

  for (const [index, child] of children.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: child.slug },
      create: {
        name: child.name,
        slug: child.slug,
        parentId: ids[child.parent],
        imageUrl: PLACEHOLDER(child.name, 400),
        position: index,
        isActive: true,
        showInMenu: true,
      },
      update: { parentId: ids[child.parent] },
      select: { id: true },
    });
    ids[child.slug] = row.id;
  }

  console.log(`  ✓ ${roots.length + children.length} categories`);
  return ids;
}

async function seedBrands() {
  const brands = [
    { name: "Trust Select", slug: "trust-select" },
    { name: "Ajwa Gardens", slug: "ajwa-gardens" },
    { name: "Sundarban Naturals", slug: "sundarban-naturals" },
    { name: "StepEase", slug: "stepease" },
  ];

  const ids: Record<string, string> = {};
  for (const [index, brand] of brands.entries()) {
    const row = await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: { name: brand.name, slug: brand.slug, position: index, isActive: true, logoUrl: PLACEHOLDER(brand.name, 200) },
      update: {},
      select: { id: true },
    });
    ids[brand.slug] = row.id;
  }

  console.log(`  ✓ ${brands.length} brands`);
  return ids;
}

async function seedAttributes() {
  const attributes = [
    {
      name: "Weight", slug: "weight", type: "SELECT" as const, unit: "g/kg",
      options: [["500g", "500g"], ["1kg", "1kg"], ["2kg", "2kg"]],
    },
    {
      name: "Volume", slug: "volume", type: "SELECT" as const, unit: "ml/L",
      options: [["500ml", "500ml"], ["1l", "1L"], ["2l", "2L"]],
    },
    {
      name: "Shoe Size", slug: "shoe-size", type: "SELECT" as const, unit: "EU",
      options: [["43", "43"], ["44", "44"], ["45", "45"], ["46", "46"]],
    },
    {
      name: "Colour", slug: "colour", type: "COLOR" as const, unit: null,
      options: [["black", "Black", "#111827"], ["brown", "Brown", "#7c4a26"], ["white", "White", "#f8fafc"], ["blue", "Blue", "#1d4ed8"]],
    },
    {
      name: "Size", slug: "size", type: "SELECT" as const, unit: null,
      options: [["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]],
    },
    {
      name: "Pack", slug: "pack", type: "SELECT" as const, unit: null,
      options: [["single", "Single"], ["pack-of-3", "Pack of 3"], ["pack-of-6", "Pack of 6"]],
    },
  ];

  const attributeIds: Record<string, string> = {};
  const optionIds: Record<string, string> = {};

  for (const [index, attribute] of attributes.entries()) {
    const row = await prisma.attribute.upsert({
      where: { slug: attribute.slug },
      create: { name: attribute.name, slug: attribute.slug, type: attribute.type, unit: attribute.unit, position: index },
      update: {},
      select: { id: true },
    });
    attributeIds[attribute.slug] = row.id;

    for (const [optionIndex, option] of attribute.options.entries()) {
      const [value, label, colorHex] = option;
      const optionRow = await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: row.id, value: value! } },
        create: { attributeId: row.id, value: value!, label: label!, colorHex: colorHex ?? null, position: optionIndex },
        update: { label: label!, colorHex: colorHex ?? null },
        select: { id: true },
      });
      optionIds[`${attribute.slug}:${value}`] = optionRow.id;
    }
  }

  console.log(`  ✓ ${attributes.length} attributes with options`);
  return { attributeIds, optionIds };
}

type ProductSeed = {
  name: string;
  slug: string;
  sku: string;
  category: string;
  brand?: string;
  short: string;
  description: string;
  price: number;
  compareAt?: number;
  stock: number;
  featured?: boolean;
  topSelling?: boolean;
  shippingMode?: "STANDARD" | "FREE" | "FIXED";
  shippingFlatFee?: number;
  tags: string[];
  specs: Array<{ label: string; value: string }>;
  images: number;
};

async function seedProducts(
  categoryIds: Record<string, string>,
  brandIds: Record<string, string>,
  createdById: string,
) {
  const products: ProductSeed[] = [
    {
      name: "Premium Ajwa Dates",
      slug: "premium-ajwa-dates",
      sku: "TM-DATES-AJWA",
      category: "dates-dry-fruits",
      brand: "ajwa-gardens",
      short: "Soft, rich Ajwa dates packed fresh. Available in 500g, 1kg and 2kg.",
      description:
        "Hand-selected Ajwa dates with a deep caramel sweetness and soft texture. Vacuum packed to keep them fresh, and sold in three sizes so you can buy for the family or for gifting.",
      price: taka(500),
      compareAt: taka(650),
      stock: 0,
      featured: true,
      topSelling: true,
      tags: ["dates", "ajwa", "ramadan", "gift"],
      specs: [
        { label: "Origin", value: "Madinah" },
        { label: "Storage", value: "Cool, dry place" },
        { label: "Shelf life", value: "12 months" },
      ],
      images: 3,
    },
    {
      name: "Sundarban Raw Honey",
      slug: "sundarban-raw-honey",
      sku: "TM-HONEY-SB",
      category: "honey-spreads",
      brand: "sundarban-naturals",
      short: "Unprocessed raw honey from the Sundarbans. 500ml and 1L jars.",
      description:
        "Collected by traditional honey hunters in the Sundarbans and bottled without heating or filtering, so the natural pollen and enzymes stay intact.",
      price: taka(450),
      compareAt: taka(550),
      stock: 0,
      featured: true,
      tags: ["honey", "raw", "natural", "sundarban"],
      specs: [
        { label: "Type", value: "Raw, unpasteurised" },
        { label: "Source", value: "Sundarban mangrove forest" },
      ],
      images: 2,
    },
    {
      name: "StepEase Casual Leather Shoes",
      slug: "stepease-casual-leather-shoes",
      sku: "TM-SHOE-CAS",
      category: "mens-shoes",
      brand: "stepease",
      short: "Full-grain leather casual shoes. Sizes 43–46 in Black and Brown.",
      description:
        "Everyday leather shoes with a cushioned insole and a stitched rubber outsole. Comfortable enough for a full day on your feet.",
      price: taka(1800),
      compareAt: taka(2400),
      stock: 0,
      featured: true,
      topSelling: true,
      tags: ["shoes", "leather", "casual", "men"],
      specs: [
        { label: "Upper", value: "Full-grain leather" },
        { label: "Sole", value: "Rubber, stitched" },
        { label: "Warranty", value: "3 months" },
      ],
      images: 3,
    },
    {
      name: "Trust Select Cotton T-Shirt",
      slug: "trust-select-cotton-t-shirt",
      sku: "TM-TSHIRT-CT",
      category: "t-shirts",
      brand: "trust-select",
      short: "180 GSM combed cotton tee. S–XL in four colours.",
      description:
        "A properly made basic: 180 GSM combed cotton, bias-taped shoulders and a collar that keeps its shape after washing.",
      price: taka(650),
      compareAt: taka(850),
      stock: 0,
      tags: ["t-shirt", "cotton", "casual"],
      specs: [
        { label: "Fabric", value: "180 GSM combed cotton" },
        { label: "Fit", value: "Regular" },
        { label: "Care", value: "Machine wash cold" },
      ],
      images: 2,
    },
    {
      name: "Aromatic Kalijira Rice 5kg",
      slug: "aromatic-kalijira-rice-5kg",
      sku: "TM-RICE-KJ5",
      category: "rice-grains",
      brand: "trust-select",
      short: "Fine aromatic Kalijira rice, 5kg bag. Free delivery nationwide.",
      description:
        "Small-grain aromatic Kalijira rice — the traditional choice for polao and biryani. Cleaned, sorted and packed in a resealable 5kg bag.",
      price: taka(850),
      stock: 120,
      featured: true,
      shippingMode: "FREE",
      tags: ["rice", "kalijira", "aromatic"],
      specs: [
        { label: "Weight", value: "5 kg" },
        { label: "Type", value: "Kalijira aromatic" },
      ],
      images: 2,
    },
    {
      name: "Stainless Steel Cookware Set",
      slug: "stainless-steel-cookware-set",
      sku: "TM-COOK-SS7",
      category: "kitchen",
      brand: "trust-select",
      short: "7-piece induction-ready cookware set. Fixed ৳100 delivery charge.",
      description:
        "Heavy-gauge stainless steel with an encapsulated base for even heating. Induction, gas and electric compatible. Because of its weight this set carries its own delivery charge.",
      price: taka(4500),
      compareAt: taka(5800),
      stock: 25,
      shippingMode: "FIXED",
      shippingFlatFee: taka(100),
      topSelling: true,
      tags: ["cookware", "kitchen", "steel"],
      specs: [
        { label: "Pieces", value: "7" },
        { label: "Material", value: "304 stainless steel" },
        { label: "Induction ready", value: "Yes" },
      ],
      images: 2,
    },
    {
      name: "Cold Pressed Mustard Oil",
      slug: "cold-pressed-mustard-oil",
      sku: "TM-OIL-MST",
      category: "groceries",
      brand: "sundarban-naturals",
      short: "Traditional ghani cold-pressed mustard oil. 500ml, 1L and 2L.",
      description:
        "Pressed slowly in a wooden ghani so the oil keeps its pungency and aroma. Nothing added, nothing refined out.",
      price: taka(320),
      stock: 0,
      tags: ["oil", "mustard", "cold pressed"],
      specs: [
        { label: "Extraction", value: "Wooden ghani, cold pressed" },
        { label: "Shelf life", value: "9 months" },
      ],
      images: 2,
    },
    {
      name: "Herbal Face Wash",
      slug: "herbal-face-wash",
      sku: "TM-FACE-HRB",
      category: "health-beauty",
      brand: "trust-select",
      short: "Gentle daily face wash with neem and tulsi.",
      description: "A mild, non-drying daily cleanser with neem and tulsi extract. Suitable for oily and combination skin.",
      price: taka(280),
      compareAt: taka(350),
      stock: 200,
      tags: ["face wash", "herbal", "skincare"],
      specs: [
        { label: "Volume", value: "150 ml" },
        { label: "Skin type", value: "Oily / combination" },
      ],
      images: 1,
    },
  ];

  const ids: Record<string, string> = {};

  for (const product of products) {
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        categoryId: categoryIds[product.category],
        brandId: product.brand ? brandIds[product.brand] : null,
        shortDescription: product.short,
        description: product.description,
        specifications: product.specs,
        price: product.price,
        compareAtPrice: product.compareAt ?? null,
        stock: product.stock,
        lowStockThreshold: 5,
        tags: product.tags,
        status: "PUBLISHED",
        isFeatured: product.featured ?? false,
        isTopSelling: product.topSelling ?? false,
        shippingMode: product.shippingMode ?? "STANDARD",
        shippingFlatFee: product.shippingFlatFee ?? null,
        publishedAt: new Date(),
        createdById,
        seoTitle: `${product.name} — Trust Mart`,
        seoDescription: product.short,
        images: {
          create: Array.from({ length: product.images }, (_, index) => ({
            url: PLACEHOLDER(`${product.name} ${index + 1}`),
            alt: `${product.name} — image ${index + 1}`,
            position: index,
            isPrimary: index === 0,
          })),
        },
      },
      // Deliberately empty. A shop that edits a demo product's price or copy
      // must not have it reverted the next time someone runs the seed.
      update: {},
      select: { id: true },
    });
    ids[product.slug] = row.id;
  }

  console.log(`  ✓ ${products.length} products`);
  return ids;
}

/**
 * Variant examples straight from the PRD:
 *   Dates  — 500g ৳500, 1kg ৳900, 2kg ৳1,700
 *   Shoes  — size 43 ৳1,800, 44 ৳1,900, 45 ৳1,900, in Black and Brown
 *   Honey  — 500ml ৳450, 1L ৳800
 */
async function seedVariants(
  productIds: Record<string, string>,
  attributeIds: Record<string, string>,
  optionIds: Record<string, string>,
) {
  type VariantSpec = {
    productSlug: string;
    attributes: string[];
    rows: Array<{ options: string[]; name: string; sku: string; price: number; stock: number; compareAt?: number }>;
  };

  const specs: VariantSpec[] = [
    {
      productSlug: "premium-ajwa-dates",
      attributes: ["weight"],
      rows: [
        { options: ["weight:500g"], name: "500g", sku: "TM-DATES-AJWA-500G", price: taka(500), compareAt: taka(650), stock: 60 },
        { options: ["weight:1kg"], name: "1kg", sku: "TM-DATES-AJWA-1KG", price: taka(900), compareAt: taka(1200), stock: 40 },
        { options: ["weight:2kg"], name: "2kg", sku: "TM-DATES-AJWA-2KG", price: taka(1700), compareAt: taka(2300), stock: 18 },
      ],
    },
    {
      productSlug: "sundarban-raw-honey",
      attributes: ["volume"],
      rows: [
        { options: ["volume:500ml"], name: "500ml", sku: "TM-HONEY-SB-500ML", price: taka(450), stock: 50 },
        { options: ["volume:1l"], name: "1L", sku: "TM-HONEY-SB-1L", price: taka(800), stock: 30 },
      ],
    },
    {
      productSlug: "stepease-casual-leather-shoes",
      attributes: ["shoe-size", "colour"],
      rows: [
        { options: ["shoe-size:43", "colour:black"], name: "43 / Black", sku: "TM-SHOE-43-BLK", price: taka(1800), stock: 12 },
        { options: ["shoe-size:43", "colour:brown"], name: "43 / Brown", sku: "TM-SHOE-43-BRN", price: taka(1800), stock: 8 },
        { options: ["shoe-size:44", "colour:black"], name: "44 / Black", sku: "TM-SHOE-44-BLK", price: taka(1900), stock: 14 },
        { options: ["shoe-size:44", "colour:brown"], name: "44 / Brown", sku: "TM-SHOE-44-BRN", price: taka(1900), stock: 6 },
        { options: ["shoe-size:45", "colour:black"], name: "45 / Black", sku: "TM-SHOE-45-BLK", price: taka(1900), stock: 9 },
        { options: ["shoe-size:45", "colour:brown"], name: "45 / Brown", sku: "TM-SHOE-45-BRN", price: taka(1900), stock: 4 },
      ],
    },
    {
      productSlug: "trust-select-cotton-t-shirt",
      attributes: ["size", "colour"],
      rows: [
        { options: ["size:s", "colour:black"], name: "S / Black", sku: "TM-TS-S-BLK", price: taka(650), stock: 20 },
        { options: ["size:m", "colour:black"], name: "M / Black", sku: "TM-TS-M-BLK", price: taka(650), stock: 25 },
        { options: ["size:l", "colour:black"], name: "L / Black", sku: "TM-TS-L-BLK", price: taka(700), stock: 18 },
        { options: ["size:xl", "colour:black"], name: "XL / Black", sku: "TM-TS-XL-BLK", price: taka(750), stock: 10 },
        { options: ["size:m", "colour:white"], name: "M / White", sku: "TM-TS-M-WHT", price: taka(650), stock: 22 },
        { options: ["size:l", "colour:white"], name: "L / White", sku: "TM-TS-L-WHT", price: taka(700), stock: 15 },
        { options: ["size:m", "colour:blue"], name: "M / Blue", sku: "TM-TS-M-BLU", price: taka(650), stock: 12 },
      ],
    },
    {
      productSlug: "cold-pressed-mustard-oil",
      attributes: ["volume"],
      rows: [
        { options: ["volume:500ml"], name: "500ml", sku: "TM-OIL-MST-500ML", price: taka(320), stock: 40 },
        { options: ["volume:1l"], name: "1L", sku: "TM-OIL-MST-1L", price: taka(600), stock: 28 },
        { options: ["volume:2l"], name: "2L", sku: "TM-OIL-MST-2L", price: taka(1150), stock: 12 },
      ],
    },
  ];

  let variantCount = 0;

  for (const spec of specs) {
    const productId = productIds[spec.productSlug];
    if (!productId) continue;

    for (const [index, attributeSlug] of spec.attributes.entries()) {
      await prisma.productAttribute.upsert({
        where: { productId_attributeId: { productId, attributeId: attributeIds[attributeSlug]! } },
        create: { productId, attributeId: attributeIds[attributeSlug]!, position: index },
        update: { position: index },
      });
    }

    for (const [index, row] of spec.rows.entries()) {
      const existing = await prisma.productVariant.findUnique({ where: { sku: row.sku }, select: { id: true } });
      if (existing) {
        await prisma.productVariant.update({
          where: { id: existing.id },
          data: { price: row.price, stock: row.stock, compareAtPrice: row.compareAt ?? null, isActive: true },
        });
        continue;
      }

      await prisma.productVariant.create({
        data: {
          productId,
          name: row.name,
          sku: row.sku,
          price: row.price,
          compareAtPrice: row.compareAt ?? null,
          stock: row.stock,
          lowStockThreshold: 3,
          position: index,
          isActive: true,
          options: {
            create: row.options.map((key) => {
              const [attributeSlug] = key.split(":");
              return { attributeId: attributeIds[attributeSlug!]!, optionId: optionIds[key]! };
            }),
          },
        },
      });
      variantCount += 1;
    }

    // Keep the product's headline price and total stock in step with its variants.
    const aggregate = await prisma.productVariant.aggregate({
      where: { productId, isActive: true },
      _min: { price: true },
      _sum: { stock: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: {
        hasVariants: true,
        price: aggregate._min.price ?? undefined,
        stock: aggregate._sum.stock ?? 0,
      },
    });
  }

  console.log(`  ✓ ${variantCount} new product variants`);
}

async function seedPromotions(productIds: Record<string, string>, categoryIds: Record<string, string>, createdById: string) {
  const now = new Date();
  const inAMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // 1. Product-specific ৳100 coupon.
  const datesCoupon = await prisma.coupon.upsert({
    where: { code: "DATES100" },
    create: {
      code: "DATES100",
      title: "৳100 off Premium Ajwa Dates",
      description: "Product-specific coupon — applies only to the selected products.",
      discountType: "FIXED",
      discountValue: taka(100),
      minOrderAmount: taka(500),
      startAt: now,
      endAt: inAMonth,
      usageLimit: 500,
      perCustomerLimit: 2,
      isActive: true,
      scope: "PRODUCT",
      allowOnFlashSale: false,
      allowStacking: false,
      createdById,
    },
    update: {},
    select: { id: true },
  });
  await prisma.couponProduct.upsert({
    where: { couponId_productId: { couponId: datesCoupon.id, productId: productIds["premium-ajwa-dates"]! } },
    create: { couponId: datesCoupon.id, productId: productIds["premium-ajwa-dates"]! },
    update: {},
  });

  // 2. Global 10% coupon.
  await prisma.coupon.upsert({
    where: { code: "TRUST10" },
    create: {
      code: "TRUST10",
      title: "10% off everything",
      description: "Global coupon, capped at ৳300.",
      discountType: "PERCENT",
      discountValue: 10,
      minOrderAmount: taka(1000),
      maxDiscountAmount: taka(300),
      startAt: now,
      endAt: inAMonth,
      perCustomerLimit: 1,
      isActive: true,
      scope: "GLOBAL",
      allowOnFlashSale: false,
      allowStacking: false,
      createdById,
    },
    update: {},
  });

  // 3. Two-hour coupon — expires automatically.
  await prisma.coupon.upsert({
    where: { code: "FLASH2H" },
    create: {
      code: "FLASH2H",
      title: "2-hour flash coupon",
      description: "৳150 off, valid for two hours from seeding — demonstrates short-duration coupons.",
      discountType: "FIXED",
      discountValue: taka(150),
      minOrderAmount: taka(1500),
      startAt: now,
      endAt: inTwoHours,
      usageLimit: 50,
      perCustomerLimit: 1,
      isActive: true,
      scope: "GLOBAL",
      allowOnFlashSale: true,
      allowStacking: false,
      createdById,
    },
    update: {},
  });

  // 4. Category coupon.
  const groceryCoupon = await prisma.coupon.upsert({
    where: { code: "GROCERY50" },
    create: {
      code: "GROCERY50",
      title: "৳50 off groceries",
      discountType: "FIXED",
      discountValue: taka(50),
      minOrderAmount: taka(400),
      startAt: now,
      endAt: inAMonth,
      isActive: true,
      scope: "CATEGORY",
      createdById,
    },
    update: {},
    select: { id: true },
  });
  await prisma.couponCategory.upsert({
    where: { couponId_categoryId: { couponId: groceryCoupon.id, categoryId: categoryIds["groceries"]! } },
    create: { couponId: groceryCoupon.id, categoryId: categoryIds["groceries"]! },
    update: {},
  });

  // A two-hour promotional offer on the honey.
  const existingOffer = await prisma.offer.findFirst({ where: { title: "2-hour honey offer" } });
  if (!existingOffer) {
    const offer = await prisma.offer.create({
      data: {
        title: "2-hour honey offer",
        description: "15% off raw honey — ends automatically.",
        discountType: "PERCENT",
        discountValue: 15,
        scope: "PRODUCT",
        startAt: now,
        endAt: inTwoHours,
        isActive: true,
        priority: 10,
        badgeText: "2-hour offer",
        showCountdown: true,
      },
      select: { id: true },
    });
    await prisma.offerProduct.create({
      data: { offerId: offer.id, productId: productIds["sundarban-raw-honey"]! },
    });
  }

  // Flash sale with two products.
  const existingSale = await prisma.flashSale.findFirst({ where: { title: "Weekend Flash Sale" } });
  if (!existingSale) {
    const sale = await prisma.flashSale.create({
      data: {
        title: "Weekend Flash Sale",
        description: "Limited stock at a lower price — while it lasts.",
        startAt: now,
        endAt: inThreeDays,
        isActive: true,
        position: 0,
      },
      select: { id: true },
    });
    await prisma.flashSaleItem.createMany({
      data: [
        { flashSaleId: sale.id, productId: productIds["stainless-steel-cookware-set"]!, salePrice: taka(3900), stockLimit: 10, position: 0 },
        { flashSaleId: sale.id, productId: productIds["herbal-face-wash"]!, salePrice: taka(210), stockLimit: 40, position: 1 },
      ],
      skipDuplicates: true,
    });
  }

  console.log("  ✓ 4 coupons, 1 two-hour offer, 1 flash sale");
}

/**
 * Demo artwork for the banners that have one, keyed by banner title so both
 * seeding and the refresh below derive the same image.
 */
const BANNER_IMAGES: Record<string, { label: string; size: number }> = {
  "Genuine products, delivered with care": { label: "Trust Mart", size: 1600 },
  "Ramadan pantry": { label: "Ramadan", size: 800 },
  "New footwear": { label: "Footwear", size: 800 },
};

/**
 * Points existing demo artwork at the current local images.
 *
 * The upserts above only set imagery when they create a row, so re-running the
 * seed on a database that already has demo content would otherwise leave it
 * pointing at whatever the previous version used. Only images this seed
 * produced are touched — anything an admin uploaded is left exactly as it is.
 */
async function refreshDemoImagery() {
  let updated = 0;

  const categories = await prisma.category.findMany({ select: { id: true, name: true, imageUrl: true } });
  for (const category of categories) {
    if (!isDemoImage(category.imageUrl)) continue;
    const url = PLACEHOLDER(category.name, 400);
    if (url === category.imageUrl) continue;
    await prisma.category.update({ where: { id: category.id }, data: { imageUrl: url } });
    updated += 1;
  }

  const brands = await prisma.brand.findMany({ select: { id: true, name: true, logoUrl: true } });
  for (const brand of brands) {
    if (!isDemoImage(brand.logoUrl)) continue;
    const url = PLACEHOLDER(brand.name, 200);
    if (url === brand.logoUrl) continue;
    await prisma.brand.update({ where: { id: brand.id }, data: { logoUrl: url } });
    updated += 1;
  }

  const banners = await prisma.banner.findMany({ select: { id: true, title: true, imageUrl: true } });
  for (const banner of banners) {
    if (!isDemoImage(banner.imageUrl)) continue;
    const artwork = BANNER_IMAGES[banner.title];
    if (!artwork) continue;
    const url = PLACEHOLDER(artwork.label, artwork.size);
    if (url === banner.imageUrl) continue;
    await prisma.banner.update({ where: { id: banner.id }, data: { imageUrl: url } });
    updated += 1;
  }

  const images = await prisma.productImage.findMany({
    select: { id: true, url: true, position: true, product: { select: { name: true } } },
  });
  for (const image of images) {
    if (!isDemoImage(image.url)) continue;
    const url = PLACEHOLDER(`${image.product.name} ${image.position + 1}`);
    if (url === image.url) continue;
    await prisma.productImage.update({ where: { id: image.id }, data: { url } });
    updated += 1;
  }

  if (updated > 0) console.log(`  ✓ refreshed ${updated} demo images to local artwork`);
}

async function seedBanners() {
  const banners = [
    {
      title: "Genuine products, delivered with care",
      subtitle: "Cash on delivery across all 64 districts",
      placement: "HOME_HERO" as const,
      linkUrl: "/shop",
      ctaLabel: "Shop now",
      priority: 10,
    },
    {
      title: "Ramadan pantry",
      subtitle: "Dates, honey and everyday essentials",
      placement: "HOME_HERO" as const,
      linkUrl: "/category/groceries",
      ctaLabel: "Browse groceries",
      priority: 5,
    },
    {
      title: "New footwear",
      subtitle: "Leather shoes in sizes 43–46",
      placement: "HOME_HERO" as const,
      linkUrl: "/category/footwear",
      ctaLabel: "See the range",
      priority: 4,
    },
    {
      title: "Free delivery on 5kg rice",
      subtitle: "No delivery charge, any district",
      placement: "HOME_STRIP" as const,
      linkUrl: "/product/aromatic-kalijira-rice-5kg",
      priority: 3,
    },
    {
      title: "Cash on delivery",
      subtitle: "Pay only when your parcel arrives",
      placement: "HOME_STRIP" as const,
      linkUrl: "/help",
      priority: 2,
    },
    {
      title: "Easy returns",
      subtitle: "7 days to report a problem",
      placement: "HOME_STRIP" as const,
      linkUrl: "/returns",
      priority: 1,
    },
  ];

  for (const banner of banners) {
    const existing = await prisma.banner.findFirst({ where: { title: banner.title, placement: banner.placement } });
    if (existing) continue;
    const artwork = BANNER_IMAGES[banner.title];
    await prisma.banner.create({
      data: { ...banner, imageUrl: artwork ? PLACEHOLDER(artwork.label, artwork.size) : null, isActive: true },
    });
  }

  console.log(`  ✓ ${banners.length} banners`);
}

async function seedHomeSections() {
  const sections = [
    { key: "hero", type: "HERO" as const, title: null, subtitle: "Trusted marketplace", position: 0 },
    { key: "categories", type: "CATEGORY_GRID" as const, title: "Shop by category", subtitle: "Everything, sorted", position: 1 },
    { key: "flash-sale", type: "FLASH_SALE" as const, title: null, subtitle: null, position: 2 },
    { key: "featured", type: "FEATURED_PRODUCTS" as const, title: "Featured products", subtitle: "Hand-picked by our team", position: 3 },
    { key: "strip", type: "BANNER" as const, title: null, subtitle: null, position: 4 },
    { key: "top-selling", type: "TOP_SELLING" as const, title: "Top selling", subtitle: "What customers buy most", position: 5 },
    { key: "new-arrivals", type: "NEW_ARRIVALS" as const, title: "New arrivals", subtitle: "Just added to the catalogue", position: 6 },
    { key: "trust", type: "TRUST_BADGES" as const, title: "Why shop with us", subtitle: null, position: 7 },
    { key: "testimonials", type: "TESTIMONIALS" as const, title: "What customers say", subtitle: null, position: 8 },
  ];

  for (const section of sections) {
    await prisma.homeSection.upsert({
      where: { key: section.key },
      create: { ...section, config: { limit: 8 }, isActive: true },
      update: { position: section.position },
    });
  }

  console.log(`  ✓ ${sections.length} homepage sections`);
}

async function seedTestimonials() {
  const testimonials = [
    { name: "Farhana A.", role: "Dhaka", rating: 5, body: "Ordered dates for Ramadan and they arrived the next day, exactly as described. The delivery charge was clear before I confirmed." },
    { name: "Shakil M.", role: "Chattogram", rating: 5, body: "Bought shoes in size 44. Real leather, comfortable, and the size chart was accurate." },
    { name: "Rumana K.", role: "Sylhet", rating: 4, body: "Honey is genuinely raw — you can tell. Free delivery to Sylhet was a nice surprise." },
    { name: "Tanvir H.", role: "Rajshahi", rating: 5, body: "Had an issue with one item and support sorted it out over messages within a day." },
  ];

  for (const [index, testimonial] of testimonials.entries()) {
    const existing = await prisma.testimonial.findFirst({ where: { name: testimonial.name } });
    if (existing) continue;
    await prisma.testimonial.create({ data: { ...testimonial, position: index, isActive: true } });
  }

  console.log(`  ✓ ${testimonials.length} testimonials`);
}

async function seedContent() {
  for (const page of SEED_PAGES) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        excerpt: page.excerpt,
        content: page.content,
        type: page.type,
        position: page.position,
        isPublished: true,
        seoTitle: `${page.title} — Trust Mart`,
        seoDescription: page.excerpt,
      },
      // Deliberately empty. Policy pages are the first thing a shop rewrites.
      update: {},
    });
  }

  for (const [index, faq] of SEED_FAQS.entries()) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question } });
    if (existing) continue;
    await prisma.faq.create({
      data: { question: faq.question, answer: faq.answer, category: faq.category, position: index, isActive: true },
    });
  }

  console.log(`  ✓ ${SEED_PAGES.length} pages, ${SEED_FAQS.length} FAQ entries`);
}

async function seedNavigation(categoryIds: Record<string, string>) {
  const menus = [
    { key: "MAIN", title: "Main navigation" },
    { key: "FOOTER_SHOP", title: "Footer — Shop" },
    { key: "FOOTER_HELP", title: "Footer — Help" },
    { key: "FOOTER_COMPANY", title: "Footer — Company" },
  ];

  const menuIds: Record<string, string> = {};
  for (const menu of menus) {
    const row = await prisma.navigationMenu.upsert({
      where: { key: menu.key },
      create: menu,
      update: {},
      select: { id: true },
    });
    menuIds[menu.key] = row.id;
  }

  const pages = await prisma.page.findMany({ select: { id: true, slug: true } });
  const pageId = (slug: string) => pages.find((page) => page.slug === slug)?.id ?? null;

  type NavSeed = {
    menu: string;
    label: string;
    type: "INTERNAL" | "CATEGORY" | "PAGE" | "EXTERNAL";
    url?: string;
    categorySlug?: string;
    pageSlug?: string;
    position: number;
    isMegaColumn?: boolean;
    children?: NavSeed[];
  };

  const items: NavSeed[] = [
    { menu: "MAIN", label: "All products", type: "INTERNAL", url: "/shop", position: 0 },
    {
      menu: "MAIN", label: "Groceries", type: "CATEGORY", categorySlug: "groceries", position: 1, isMegaColumn: true,
      children: [
        { menu: "MAIN", label: "Dates & Dry Fruits", type: "CATEGORY", categorySlug: "dates-dry-fruits", position: 0 },
        { menu: "MAIN", label: "Honey & Spreads", type: "CATEGORY", categorySlug: "honey-spreads", position: 1 },
        { menu: "MAIN", label: "Rice & Grains", type: "CATEGORY", categorySlug: "rice-grains", position: 2 },
      ],
    },
    {
      menu: "MAIN", label: "Footwear", type: "CATEGORY", categorySlug: "footwear", position: 2,
      children: [{ menu: "MAIN", label: "Men's Shoes", type: "CATEGORY", categorySlug: "mens-shoes", position: 0 }],
    },
    {
      menu: "MAIN", label: "Fashion", type: "CATEGORY", categorySlug: "fashion", position: 3,
      children: [{ menu: "MAIN", label: "T-Shirts", type: "CATEGORY", categorySlug: "t-shirts", position: 0 }],
    },
    {
      menu: "MAIN", label: "Home & Living", type: "CATEGORY", categorySlug: "home-living", position: 4,
      children: [{ menu: "MAIN", label: "Kitchen", type: "CATEGORY", categorySlug: "kitchen", position: 0 }],
    },

    { menu: "FOOTER_SHOP", label: "All products", type: "INTERNAL", url: "/shop", position: 0 },
    { menu: "FOOTER_SHOP", label: "Groceries", type: "CATEGORY", categorySlug: "groceries", position: 1 },
    { menu: "FOOTER_SHOP", label: "Footwear", type: "CATEGORY", categorySlug: "footwear", position: 2 },
    { menu: "FOOTER_SHOP", label: "Fashion", type: "CATEGORY", categorySlug: "fashion", position: 3 },

    { menu: "FOOTER_HELP", label: "Help centre", type: "INTERNAL", url: "/help", position: 0 },
    { menu: "FOOTER_HELP", label: "FAQ", type: "INTERNAL", url: "/faq", position: 1 },
    { menu: "FOOTER_HELP", label: "Track your order", type: "INTERNAL", url: "/track-order", position: 2 },
    { menu: "FOOTER_HELP", label: "Shipping & delivery", type: "PAGE", pageSlug: "shipping", position: 3 },
    { menu: "FOOTER_HELP", label: "Returns", type: "PAGE", pageSlug: "returns", position: 4 },

    { menu: "FOOTER_COMPANY", label: "About us", type: "PAGE", pageSlug: "about", position: 0 },
    { menu: "FOOTER_COMPANY", label: "Contact", type: "INTERNAL", url: "/contact", position: 1 },
    { menu: "FOOTER_COMPANY", label: "Terms & conditions", type: "PAGE", pageSlug: "terms", position: 2 },
    { menu: "FOOTER_COMPANY", label: "Privacy policy", type: "PAGE", pageSlug: "privacy", position: 3 },
    { menu: "FOOTER_COMPANY", label: "Refund policy", type: "PAGE", pageSlug: "refund-policy", position: 4 },
  ];

  async function createItem(item: NavSeed, parentId: string | null) {
    const existing = await prisma.navigationItem.findFirst({
      where: { menuId: menuIds[item.menu], label: item.label, parentId },
      select: { id: true },
    });
    const data = {
      menuId: menuIds[item.menu]!,
      parentId,
      label: item.label,
      type: item.type,
      url: item.url ?? null,
      categoryId: item.categorySlug ? (categoryIds[item.categorySlug] ?? null) : null,
      pageId: item.pageSlug ? pageId(item.pageSlug) : null,
      position: item.position,
      isActive: true,
      isMegaColumn: item.isMegaColumn ?? false,
    };

    const row = existing
      ? await prisma.navigationItem.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.navigationItem.create({ data, select: { id: true } });

    for (const child of item.children ?? []) await createItem(child, row.id);
  }

  for (const item of items) await createItem(item, null);

  console.log(`  ✓ ${menus.length} menus with ${items.length} top-level items`);
}

async function seedCouriers() {
  const couriers = [
    { name: "Pathao Courier", code: "PATHAO", provider: "pathao", trackingUrlTemplate: "https://merchant.pathao.com/tracking?consignment_id={tracking}" },
    { name: "Steadfast", code: "STEADFAST", provider: "steadfast", trackingUrlTemplate: "https://steadfast.com.bd/t/{tracking}" },
    { name: "RedX", code: "REDX", provider: "redx", trackingUrlTemplate: "https://redx.com.bd/track-parcel/?trackingId={tracking}" },
    { name: "Sundarban Courier", code: "SUNDARBAN", provider: "manual", trackingUrlTemplate: null },
  ];

  for (const [index, courier] of couriers.entries()) {
    await prisma.courier.upsert({
      where: { code: courier.code },
      create: {
        name: courier.name,
        code: courier.code,
        provider: courier.provider,
        trackingUrlTemplate: courier.trackingUrlTemplate,
        isActive: true,
        position: index,
        description: "Manual tracking is available now; add API credentials to your environment to automate it.",
      },
      update: {},
    });
  }

  console.log(`  ✓ ${couriers.length} couriers`);
}

/**
 * One warehouse, so stock adjustments have somewhere to land.
 *
 * Warehouses are optional — inventory works without them — but a shop with a
 * single storeroom should not have to invent one before it can record damage.
 */
async function seedWarehouses() {
  const existing = await prisma.warehouse.count();
  if (existing > 0) {
    console.log("  • warehouses already exist, skipping");
    return;
  }

  await prisma.warehouse.create({
    data: {
      name: "Main store",
      code: "main",
      city: "Dhaka",
      isDefault: true,
      isActive: true,
      note: "Created by the seed. Rename it, or add more sites, from Inventory → Warehouses.",
    },
  });

  console.log("  ✓ 1 warehouse (Main store)");
}

/**
 * The chart of accounts and expense buckets a Bangladeshi retail shop needs.
 *
 * System categories are the ones automatic postings reference by slug, so they
 * are marked and cannot be deleted from the dashboard.
 */
async function seedFinance() {
  const accounts = [
    { name: "Cash in hand", code: "cash", type: "CASH" as const, position: 0 },
    { name: "Bank account", code: "bank", type: "BANK" as const, position: 1 },
    { name: "bKash merchant", code: "bkash", type: "MOBILE_WALLET" as const, position: 2 },
    { name: "Courier receivable", code: "courier-receivable", type: "COURIER_RECEIVABLE" as const, position: 3 },
  ];

  for (const account of accounts) {
    await prisma.financeAccount.upsert({
      where: { code: account.code },
      create: account,
      update: {},
    });
  }

  const categories = [
    { name: "Product sales", slug: "product-sales", kind: "INCOME" as const, isSystem: true },
    { name: "Delivery charges collected", slug: "delivery-income", kind: "INCOME" as const, isSystem: true },
    { name: "Other income", slug: "other-income", kind: "INCOME" as const },

    { name: "Product cost", slug: "product-cost", kind: "EXPENSE" as const, isSystem: true },
    { name: "Courier charges", slug: "courier-charge", kind: "EXPENSE" as const, isSystem: true },
    { name: "Packaging", slug: "packaging", kind: "EXPENSE" as const, isSystem: true },
    { name: "Purchases & restocking", slug: "purchases", kind: "EXPENSE" as const },
    { name: "Marketing & ads", slug: "marketing", kind: "EXPENSE" as const },
    { name: "Salary", slug: "salary", kind: "EXPENSE" as const },
    { name: "Bonus", slug: "bonus", kind: "EXPENSE" as const },
    { name: "Gifts", slug: "gifts", kind: "EXPENSE" as const },
    { name: "Staff food & refreshments", slug: "staff-food", kind: "EXPENSE" as const },
    { name: "Travel & tour", slug: "travel", kind: "EXPENSE" as const },
    { name: "Office rent & utilities", slug: "office", kind: "EXPENSE" as const },
    { name: "Internet & phone", slug: "internet", kind: "EXPENSE" as const },
    { name: "Software subscriptions", slug: "software", kind: "EXPENSE" as const },
    { name: "Website & maintenance", slug: "website", kind: "EXPENSE" as const },
    { name: "Refunds paid", slug: "refunds", kind: "EXPENSE" as const, isSystem: true },
    { name: "Other expenses", slug: "other-expense", kind: "EXPENSE" as const },
  ];

  for (const [index, category] of categories.entries()) {
    await prisma.expenseCategory.upsert({
      where: { slug: category.slug },
      create: { ...category, position: index },
      update: {},
    });
  }

  console.log(`  ✓ ${accounts.length} finance accounts, ${categories.length} expense categories`);
}

async function seedDemoOrders(users: Record<string, string>) {
  const existing = await prisma.order.count();
  if (existing > 0) {
    console.log("  • demo orders already exist, skipping");
    return;
  }

  const { createInvoiceRecord } = await import("../src/lib/services/invoice-builder");

  const customerId = users[DEMO.customer.email]!;
  const dhaka = await prisma.district.findUnique({ where: { name: "Dhaka" }, select: { id: true, name: true, deliveryCharge: true } });
  const sylhet = await prisma.district.findUnique({ where: { name: "Sylhet" }, select: { id: true, name: true } });

  const dates = await prisma.product.findUnique({
    where: { slug: "premium-ajwa-dates" },
    select: { id: true, name: true, slug: true, variants: { where: { sku: "TM-DATES-AJWA-1KG" }, select: { id: true, name: true, sku: true, price: true } } },
  });
  const rice = await prisma.product.findUnique({
    where: { slug: "aromatic-kalijira-rice-5kg" },
    select: { id: true, name: true, slug: true, price: true },
  });

  if (!dhaka || !sylhet || !dates || !rice) return;

  const datesVariant = dates.variants[0]!;

  // Order 1 — delivered, so the demo customer can leave a review.
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "TM-260101-1001",
      publicToken: "demo-token-delivered-0001",
      userId: customerId,
      customerName: DEMO.customer.name,
      customerEmail: DEMO.customer.email,
      customerPhone: DEMO.customer.phone,
      status: "DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: "COD",
      subtotal: datesVariant.price * 2,
      shippingTotal: dhaka.deliveryCharge,
      grandTotal: datesVariant.price * 2 + dhaka.deliveryCharge,
      paidTotal: datesVariant.price * 2 + dhaka.deliveryCharge,
      districtId: dhaka.id,
      districtName: dhaka.name,
      shippingAddress: {
        fullName: DEMO.customer.name,
        phone: DEMO.customer.phone,
        district: dhaka.name,
        area: "Dhanmondi",
        city: "Dhaka",
        addressLine1: "House 12, Road 5, Dhanmondi",
        postalCode: "1205",
      },
      shippingSnapshot: {
        districtId: dhaka.id,
        districtName: dhaka.name,
        districtCharge: dhaka.deliveryCharge,
        strategy: "highest",
        total: dhaka.deliveryCharge,
        breakdown: [{ label: `Delivery to ${dhaka.name}`, amount: dhaka.deliveryCharge, mode: "STANDARD" }],
      },
      deliveredAt: new Date(),
      confirmedAt: new Date(),
      items: {
        create: [
          {
            productId: dates.id,
            variantId: datesVariant.id,
            productName: dates.name,
            productSlug: dates.slug,
            variantName: datesVariant.name,
            sku: datesVariant.sku,
            unitPrice: datesVariant.price,
            quantity: 2,
            lineSubtotal: datesVariant.price * 2,
            lineTotal: datesVariant.price * 2,
          },
        ],
      },
      statusEvents: {
        create: [
          { toStatus: "PENDING", note: "Order placed", actorName: DEMO.customer.name },
          { fromStatus: "PENDING", toStatus: "CONFIRMED", note: "Confirmed by phone", actorName: "Ayesha Rahman", actorRole: "ADMIN" },
          { fromStatus: "CONFIRMED", toStatus: "SHIPPED", note: "Handed to courier", actorName: "Ayesha Rahman", actorRole: "ADMIN" },
          { fromStatus: "SHIPPED", toStatus: "DELIVERED", note: "Delivered and paid", actorName: "Ayesha Rahman", actorRole: "ADMIN" },
        ],
      },
      payments: {
        create: {
          provider: "COD",
          status: "PAID",
          amount: datesVariant.price * 2 + dhaka.deliveryCharge,
          paidAt: new Date(),
          idempotencyKey: "demo-order-1",
        },
      },
    },
    select: { id: true },
  });

  // Order 2 — pending, free delivery to Sylhet on a free-delivery product.
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "TM-260102-1002",
      publicToken: "demo-token-pending-0002",
      userId: users[DEMO.customer2.email]!,
      customerName: DEMO.customer2.name,
      customerEmail: DEMO.customer2.email,
      customerPhone: DEMO.customer2.phone,
      status: "PENDING",
      paymentStatus: "UNPAID",
      paymentMethod: "COD",
      subtotal: rice.price,
      shippingTotal: 0,
      grandTotal: rice.price,
      districtId: sylhet.id,
      districtName: sylhet.name,
      shippingAddress: {
        fullName: DEMO.customer2.name,
        phone: DEMO.customer2.phone,
        district: sylhet.name,
        area: "Zindabazar",
        city: "Sylhet",
        addressLine1: "Flat 4B, Zindabazar",
        postalCode: "3100",
      },
      shippingSnapshot: {
        districtId: sylhet.id,
        districtName: sylhet.name,
        districtCharge: 0,
        strategy: "highest",
        total: 0,
        freeReason: `Free delivery in ${sylhet.name}.`,
        breakdown: [{ label: `Delivery to ${sylhet.name}`, amount: 0, mode: "FREE" }],
      },
      items: {
        create: [
          {
            productId: rice.id,
            productName: rice.name,
            productSlug: rice.slug,
            unitPrice: rice.price,
            quantity: 1,
            lineSubtotal: rice.price,
            lineTotal: rice.price,
            shippingMode: "FREE",
          },
        ],
      },
      statusEvents: { create: [{ toStatus: "PENDING", note: "Order placed", actorName: DEMO.customer2.name }] },
      payments: { create: { provider: "COD", status: "PENDING", amount: rice.price, idempotencyKey: "demo-order-2" } },
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await createInvoiceRecord(tx, order1.id);
    await createInvoiceRecord(tx, order2.id);
  });

  await prisma.address.create({
    data: {
      userId: customerId,
      label: "Home",
      fullName: DEMO.customer.name,
      phone: DEMO.customer.phone,
      districtId: dhaka.id,
      districtName: dhaka.name,
      area: "Dhanmondi",
      city: "Dhaka",
      addressLine1: "House 12, Road 5, Dhanmondi",
      postalCode: "1205",
      isDefault: true,
    },
  });

  console.log("  ✓ 2 demo orders with invoices, 1 saved address");
}

/* ========================================================================== */

async function main() {
  console.log("\nSeeding Trust Mart…\n");

  await seedPermissions();
  const users = await seedUsers();
  const superAdminId = users[DEMO.superAdmin.email]!;

  await seedSettings(superAdminId);
  await seedDistricts();
  await seedCouriers();
  await seedWarehouses();
  await seedFinance();

  const categoryIds = await seedCategories();
  const brandIds = await seedBrands();
  const { attributeIds, optionIds } = await seedAttributes();
  const productIds = await seedProducts(categoryIds, brandIds, superAdminId);
  await seedVariants(productIds, attributeIds, optionIds);

  await seedPromotions(productIds, categoryIds, superAdminId);
  await seedBanners();
  await seedContent();
  await seedHomeSections();
  await seedTestimonials();
  await seedNavigation(categoryIds);
  await seedDemoOrders(users);

  await refreshDemoImagery();
  console.log(`  ${await renderDemoImages()}`);

  console.log("\n✓ Seed complete.\n");
  console.log("  Demo sign-ins (LOCAL DEVELOPMENT ONLY — change before deploying):");
  console.log(`    Super Admin  ${DEMO.superAdmin.email} / ${DEMO.superAdmin.password}`);
  console.log(`    Admin        ${DEMO.admin.email} / ${DEMO.admin.password}`);
  console.log(`    Moderator    ${DEMO.moderator.email} / ${DEMO.moderator.password}`);
  console.log(`    Customer     ${DEMO.customer.email} / ${DEMO.customer.password}\n`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
