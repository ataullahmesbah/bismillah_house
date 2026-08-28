/**
 * Shape and defaults for every dashboard-editable settings group.
 *
 * Kept free of server-only imports so the seed script and tests can use the
 * same defaults the application does.
 */

import { UPLOAD_DEFAULTS } from "@/lib/constants";

export type SiteSettings = {
  siteName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  announcement: string;
  announcementEnabled: boolean;
  announcementLink: string | null;
  footerAbout: string;
  copyright: string;
  currency: string;
  timezone: string;
};

export type ContactSettings = {
  phone: string;
  altPhone: string;
  email: string;
  supportEmail: string;
  address: string;
  mapEmbedUrl: string | null;
  workingHours: string;
};

export type SocialSettings = {
  facebook: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  linkedin: string;
  whatsapp: string;
};

export type FeatureSettings = {
  guestCheckoutEnabled: boolean;
  requireLoginForCheckout: boolean;
  reviewsEnabled: boolean;
  requireDeliveredForReview: boolean;
  autoApproveReviews: boolean;
  chatbotEnabled: boolean;
  messagingEnabled: boolean;
  popupAdsEnabled: boolean;
  maintenanceMode: boolean;
  lowStockAlerts: boolean;
  /**
   * Require the shopper to confirm their mobile number by SMS before an order
   * can be placed. Off until an SMS provider is configured — turning it on
   * without one would block every checkout.
   */
  checkoutOtpEnabled: boolean;
};

/**
 * Look and feel a Super Admin controls without touching code.
 *
 * Only a fixed set of choices, not free-form CSS: every value maps to tokens
 * already defined in globals.css, so a bad pick cannot produce unreadable
 * text or a broken layout.
 */
export type ThemeSettings = {
  /** Which palette the primary buttons and headers use. */
  primaryColor: "graphite" | "navy";
  /** The alternate colour, for secondary calls to action. */
  secondaryColor: "graphite" | "navy" | "accent";
  /** Font pairing for the whole site. */
  fontFamily: "inter" | "manrope" | "notoSans";
};

export type SeoSettings = {
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  defaultOgImage: string | null;
  keywords: string;
  robotsIndex: boolean;
  organizationName: string;
  organizationLogo: string | null;
  organizationSameAs: string;
  geoRegion: string;
  geoPlacename: string;
  geoLatitude: string;
  geoLongitude: string;
};

export type AnalyticsSettings = {
  ga4MeasurementId: string;
  gtmContainerId: string;
  metaPixelId: string;
  metaCapiEnabled: boolean;
  metaCapiDatasetId: string;
  requireConsent: boolean;
  consentText: string;
};

export type ShippingSettings = {
  /** Bulk default applied to every district that has no override, in minor units. */
  defaultCharge: number;
  freeDeliveryOverAmount: number | null;
  /** How to combine per-product shipping overrides across a mixed cart. */
  mixedCartStrategy: "highest" | "sum" | "district_only";
  note: string;
};

export type PaymentSettings = {
  codEnabled: boolean;
  bkashEnabled: boolean;
  sslcommerzEnabled: boolean;
  codInstructions: string;
  bkashInstructions: string;
  bkashMerchantNumber: string;
  minOrderAmount: number;
};

export type AiSettings = {
  enabled: boolean;
  assistantName: string;
  greeting: string;
  fallbackMessage: string;
  maxProductsInContext: number;
  /**
   * How much of product creation the AI is allowed to do.
   *  - manual: the AI panel is hidden; everything is typed by hand.
   *  - ai:     drafting starts with the AI, but a person still approves.
   *  - hybrid: the AI fills what it can and leaves the rest blank.
   *
   * No mode publishes anything on its own. `autoPublishDrafts` is the only
   * switch that does, and it is off.
   */
  productMode: "manual" | "ai" | "hybrid";
  /** Which provider to try first. Falls through the others if it fails. */
  primaryProvider: "gemini" | "openai" | "anthropic";
  geminiModel: string;
  openaiModel: string;
  anthropicModel: string;
  /** Off means a generated draft always waits for a person. Leave it off. */
  autoPublishDrafts: boolean;
  monthlyRequestBudget: number;
};

/**
 * Inventory behaviour.
 *
 * Thresholds live per product too; these are the fallbacks used when a product
 * has not set its own.
 */
export type InventorySettings = {
  defaultLowStockThreshold: number;
  defaultReorderLevel: number;
  /** Warn on the dashboard when anything drops below its threshold. */
  lowStockBannerEnabled: boolean;
  /** Let an order be placed for stock we do not have. Off by default. */
  allowNegativeStock: boolean;
  /** Show "only N left" on the product page once stock is this low. */
  showStockCountBelow: number;
  /** Value stock at what we paid, or at what we sell it for. */
  valuationBasis: "cost" | "retail";
  trackWarehouses: boolean;
};

/**
 * Courier automation.
 *
 * API credentials are NOT here — they are read from environment variables per
 * courier code, so a database dump never carries the keys.
 */
export type CourierSettings = {
  /** Create the parcel automatically once an order is confirmed. */
  autoDispatchOnConfirm: boolean;
  /** Courier code used when the dispatcher does not pick one. */
  defaultCourierCode: string;
  /** How many times to retry a failed create before asking for a human. */
  maxDispatchRetries: number;
  /** Post the courier charge and settlement into the books automatically. */
  autoPostSettlementToFinance: boolean;
  /** Move the order to Delivered when the courier reports delivery. */
  syncOrderStatusFromCourier: boolean;
  /** Let customers watch the parcel move on the track-order page. */
  customerTrackingEnabled: boolean;
};

/** Book-keeping defaults. */
export type FinanceSettings = {
  fiscalYearStartMonth: number;
  /** Post a revenue line the moment an order is placed, or once it is paid. */
  revenueRecognition: "on_order" | "on_delivery";
  /** Post product cost as an expense alongside each sale. */
  trackCostOfGoods: boolean;
  /** Flat packaging cost charged per order, in minor units. */
  packagingCostPerOrder: number;
  defaultCashAccountCode: string;
  defaultCourierAccountCode: string;
};

/** Which bot and identity checks guard the sign-in and sign-up forms. */
export type SecuritySettings = {
  /** Turnstile challenge on login and registration. Needs the keys in env. */
  turnstileEnabled: boolean;
  /** "Continue with Google". Needs the OAuth client in env. */
  googleAuthEnabled: boolean;
  /** Apply the challenge to the sign-up form as well as sign-in. */
  turnstileOnRegister: boolean;
  turnstileOnLogin: boolean;
};

export type UploadSettings = {
  maxFileSizeMb: number;
  recommendedProductImage: string;
  recommendedBanner: string;
  recommendedCategoryImage: string;
};

export type SettingsShape = {
  site: SiteSettings;
  contact: ContactSettings;
  social: SocialSettings;
  features: FeatureSettings;
  theme: ThemeSettings;
  seo: SeoSettings;
  analytics: AnalyticsSettings;
  shipping: ShippingSettings;
  payment: PaymentSettings;
  ai: AiSettings;
  inventory: InventorySettings;
  courier: CourierSettings;
  finance: FinanceSettings;
  security: SecuritySettings;
  upload: UploadSettings;
};

export const SETTINGS_DEFAULTS: SettingsShape = {
  site: {
    siteName: "Trust Mart",
    tagline: "Trusted products, delivered across Bangladesh.",
    logoUrl: null,
    faviconUrl: null,
    announcement: "Free delivery on selected products • Cash on Delivery available nationwide",
    announcementEnabled: true,
    announcementLink: null,
    footerAbout:
      "Trust Mart is an online marketplace focused on genuine products, transparent pricing and dependable delivery.",
    copyright: "© Trust Mart. All rights reserved.",
    currency: "BDT",
    timezone: "Asia/Dhaka",
  },
  contact: {
    phone: "+8801700000000",
    altPhone: "",
    email: "hello@trustmart.example",
    supportEmail: "support@trustmart.example",
    address: "House 12, Road 5, Dhanmondi, Dhaka 1205, Bangladesh",
    mapEmbedUrl: null,
    workingHours: "Saturday – Thursday, 10:00 – 20:00",
  },
  social: { facebook: "", instagram: "", youtube: "", tiktok: "", linkedin: "", whatsapp: "" },
  features: {
    guestCheckoutEnabled: true,
    requireLoginForCheckout: false,
    reviewsEnabled: true,
    requireDeliveredForReview: true,
    autoApproveReviews: false,
    chatbotEnabled: true,
    messagingEnabled: true,
    popupAdsEnabled: true,
    maintenanceMode: false,
    lowStockAlerts: true,
    checkoutOtpEnabled: false,
  },
  theme: {
    primaryColor: "graphite",
    secondaryColor: "navy",
    fontFamily: "inter",
  },
  seo: {
    defaultTitle: "Trust Mart — Online Shopping in Bangladesh",
    titleTemplate: "%s | Trust Mart",
    defaultDescription:
      "Shop genuine products at Trust Mart with cash on delivery, nationwide shipping and easy returns.",
    defaultOgImage: null,
    keywords: "online shopping bangladesh, trust mart, cash on delivery",
    robotsIndex: true,
    organizationName: "Trust Mart",
    organizationLogo: null,
    organizationSameAs: "",
    geoRegion: "BD-13",
    geoPlacename: "Dhaka",
    geoLatitude: "23.8103",
    geoLongitude: "90.4125",
  },
  analytics: {
    ga4MeasurementId: "",
    gtmContainerId: "",
    metaPixelId: "",
    metaCapiEnabled: false,
    metaCapiDatasetId: "",
    requireConsent: false,
    consentText: "We use cookies to improve your shopping experience.",
  },
  shipping: {
    defaultCharge: 12000,
    freeDeliveryOverAmount: null,
    mixedCartStrategy: "highest",
    note: "Delivery usually takes 2–4 working days depending on your district.",
  },
  payment: {
    codEnabled: true,
    bkashEnabled: false,
    sslcommerzEnabled: false,
    codInstructions: "Pay in cash when the courier hands over your parcel.",
    bkashInstructions: "Send money to the merchant number and enter the transaction ID.",
    bkashMerchantNumber: "",
    minOrderAmount: 0,
  },
  ai: {
    enabled: true,
    assistantName: "Trust Assistant",
    greeting: "Hi! Ask me about any Trust Mart product, price, stock or delivery policy.",
    fallbackMessage:
      "The AI assistant is not configured right now. You can still search the catalog or message our support team.",
    maxProductsInContext: 12,
    productMode: "manual",
    primaryProvider: "gemini",
    geminiModel: "gemini-2.0-flash",
    openaiModel: "gpt-4o-mini",
    anthropicModel: "claude-sonnet-5",
    autoPublishDrafts: false,
    monthlyRequestBudget: 500,
  },
  inventory: {
    defaultLowStockThreshold: 5,
    defaultReorderLevel: 10,
    lowStockBannerEnabled: true,
    allowNegativeStock: false,
    showStockCountBelow: 10,
    valuationBasis: "cost",
    trackWarehouses: true,
  },
  courier: {
    autoDispatchOnConfirm: false,
    defaultCourierCode: "",
    maxDispatchRetries: 3,
    autoPostSettlementToFinance: true,
    syncOrderStatusFromCourier: true,
    customerTrackingEnabled: true,
  },
  finance: {
    fiscalYearStartMonth: 7,
    revenueRecognition: "on_delivery",
    trackCostOfGoods: true,
    packagingCostPerOrder: 0,
    defaultCashAccountCode: "cash",
    defaultCourierAccountCode: "courier-receivable",
  },
  security: {
    turnstileEnabled: false,
    googleAuthEnabled: false,
    turnstileOnRegister: true,
    turnstileOnLogin: true,
  },
  upload: {
    maxFileSizeMb: UPLOAD_DEFAULTS.maxFileSizeMb,
    recommendedProductImage: UPLOAD_DEFAULTS.recommendedProductImage,
    recommendedBanner: UPLOAD_DEFAULTS.recommendedBanner,
    recommendedCategoryImage: UPLOAD_DEFAULTS.recommendedCategoryImage,
  },
};
