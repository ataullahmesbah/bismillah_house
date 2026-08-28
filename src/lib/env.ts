/**
 * Central, validated access to environment configuration.
 *
 * Rules enforced here:
 *  - secrets are only ever read on the server;
 *  - optional integrations (AI, bKash, SSLCommerz, courier, Cloudinary) may be
 *    absent and the site must still work;
 *  - a missing *required* variable fails loudly at boot instead of producing
 *    confusing runtime errors.
 */

function required(name: string, fallbackInDev?: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV !== "production" && fallbackInDev !== undefined) {
    return fallbackInDev;
  }
  throw new Error(
    `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
  );
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function bool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",

  get databaseUrl() {
    return required(
      "DATABASE_URL",
      "postgresql://postgres:postgres@127.0.0.1:5432/trustmart?schema=public",
    );
  },

  get authSecret() {
    return required("AUTH_SECRET", "development-only-insecure-secret-change-me");
  },

  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },

  sessionDays: int("SESSION_LIFETIME_DAYS", 30),

  cloudinary: {
    cloudName: optional("CLOUDINARY_CLOUD_NAME"),
    apiKey: optional("CLOUDINARY_API_KEY"),
    apiSecret: optional("CLOUDINARY_API_SECRET"),
    uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER ?? "trust-mart",
    get configured() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },

  ai: {
    provider: (process.env.AI_PROVIDER ?? "none").toLowerCase(),
    apiKey: optional("AI_API_KEY"),
    model: process.env.AI_MODEL ?? "claude-sonnet-5",
    baseUrl: optional("AI_BASE_URL"),
    maxTokens: int("AI_MAX_TOKENS", 700),
    get configured() {
      return this.provider !== "none" && Boolean(this.apiKey);
    },
  },

  bkash: {
    baseUrl: optional("BKASH_BASE_URL"),
    username: optional("BKASH_USERNAME"),
    password: optional("BKASH_PASSWORD"),
    appKey: optional("BKASH_APP_KEY"),
    appSecret: optional("BKASH_APP_SECRET"),
    get configured() {
      return Boolean(this.baseUrl && this.username && this.password && this.appKey && this.appSecret);
    },
  },

  sslcommerz: {
    storeId: optional("SSLCOMMERZ_STORE_ID"),
    storePassword: optional("SSLCOMMERZ_STORE_PASSWORD"),
    sandbox: bool("SSLCOMMERZ_SANDBOX", true),
    get configured() {
      return Boolean(this.storeId && this.storePassword);
    },
  },

  courier: {
    apiKey: optional("COURIER_API_KEY"),
    apiSecret: optional("COURIER_API_SECRET"),
    baseUrl: optional("COURIER_BASE_URL"),
    get configured() {
      return Boolean(this.apiKey && this.baseUrl);
    },
  },

  metaCapiToken: optional("META_CAPI_ACCESS_TOKEN"),

  rateLimit: {
    enabled: bool("RATE_LIMIT_ENABLED", true),
  },

  seedAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@trustmart.local",
  seedAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe#12345",
} as const;

export type Env = typeof env;
