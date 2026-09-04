import type { OrderStatus, PaymentStatus, ProductStatus, Role } from "@/generated/prisma/enums";

/* ==========================================================================
   PERMISSIONS
   Server-side authorisation keys. Hiding a UI control is never authorisation —
   every privileged action re-checks one of these on the server.
   ========================================================================== */

export const PERMISSIONS = {
  // Catalog
  PRODUCT_VIEW: "product.view",
  PRODUCT_CREATE: "product.create",
  PRODUCT_UPDATE: "product.update",
  PRODUCT_DELETE: "product.delete",
  /**
   * Take a product live. Separate from create/update so a moderator can build
   * the catalogue while approval stays with an admin.
   */
  PRODUCT_PUBLISH: "product.publish",
  /** Edit products someone else owns. Without it, editing is limited to your own. */
  PRODUCT_MANAGE_ALL: "product.manage_all",
  CATEGORY_MANAGE: "category.manage",
  BRAND_MANAGE: "brand.manage",
  ATTRIBUTE_MANAGE: "attribute.manage",
  INVENTORY_MANAGE: "inventory.manage",
  /** See stock levels and reports without being able to change them. */
  INVENTORY_VIEW: "inventory.view",
  /** Move stock by hand: damage write-offs, counts, transfers. */
  INVENTORY_ADJUST: "inventory.adjust",
  /** Raise and receive incoming supplier stock. */
  INVENTORY_RECEIVE: "inventory.receive",
  WAREHOUSE_MANAGE: "warehouse.manage",

  // Orders
  ORDER_VIEW: "order.view",
  ORDER_UPDATE_STATUS: "order.update_status",
  ORDER_CANCEL: "order.cancel",
  ORDER_REFUND: "order.refund",
  ORDER_INTERNAL_NOTE: "order.internal_note",
  ORDER_VIEW_CONTACT: "order.view_contact",
  ORDER_CUSTOMER_SEARCH: "order.customer_search",
  ORDER_FRAUD_REVIEW: "order.fraud_review",
  ORDER_INVOICE: "order.invoice",

  // Internal tokens (staff-to-staff tickets)
  TOKEN_VIEW: "token.view",
  TOKEN_CREATE: "token.create",
  TOKEN_ASSIGN: "token.assign",
  TOKEN_CLOSE: "token.close",

  // People
  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_UPDATE: "customer.update",
  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",
  ROLE_MANAGE: "role.manage",

  // Marketing
  COUPON_MANAGE: "coupon.manage",
  OFFER_MANAGE: "offer.manage",
  FLASH_SALE_MANAGE: "flash_sale.manage",
  BANNER_MANAGE: "banner.manage",

  // Content
  REVIEW_MODERATE: "review.moderate",
  MESSAGE_VIEW: "message.view",
  MESSAGE_REPLY: "message.reply",
  NOTIFICATION_SEND: "notification.send",
  CONTENT_MANAGE: "content.manage",
  NAVIGATION_MANAGE: "navigation.manage",

  // Blog. Split the same way the catalogue is: writing an article and
  // deciding it goes live are different jobs, and a writer holding only
  // BLOG_WRITE can edit their own drafts and nobody else's.
  BLOG_VIEW: "blog.view",
  BLOG_WRITE: "blog.write",
  BLOG_PUBLISH: "blog.publish",
  BLOG_MANAGE_ALL: "blog.manage_all",
  BLOG_DELETE: "blog.delete",

  // Platform
  SETTINGS_MANAGE: "settings.manage",
  SEO_MANAGE: "seo.manage",
  ANALYTICS_MANAGE: "analytics.manage",
  SHIPPING_MANAGE: "shipping.manage",
  COURIER_MANAGE: "courier.manage",
  /** Hand a parcel to the courier from the order screen. */
  COURIER_DISPATCH: "courier.dispatch",
  /** Record what the courier paid us. */
  COURIER_SETTLEMENT: "courier.settlement",
  PAYMENT_MANAGE: "payment.manage",
  REPORT_VIEW: "report.view",
  AUDIT_VIEW: "audit.view",

  // Accounts & finance
  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE: "finance.manage",
  /** Void a posted transaction. Deliberately separate from creating one. */
  FINANCE_VOID: "finance.void",
  FINANCE_EXPORT: "finance.export",

  // AI automation
  AI_USE: "ai.use",
  AI_CONFIGURE: "ai.configure",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Human labels for the role/permission editor. */
export const PERMISSION_GROUPS: Array<{ group: string; permissions: Array<{ key: Permission; label: string }> }> = [
  {
    group: "Catalog",
    permissions: [
      { key: PERMISSIONS.PRODUCT_VIEW, label: "View products" },
      { key: PERMISSIONS.PRODUCT_CREATE, label: "Create products" },
      { key: PERMISSIONS.PRODUCT_UPDATE, label: "Edit products" },
      { key: PERMISSIONS.PRODUCT_DELETE, label: "Archive / delete products" },
      { key: PERMISSIONS.PRODUCT_PUBLISH, label: "Publish products (approve drafts)" },
      { key: PERMISSIONS.PRODUCT_MANAGE_ALL, label: "Edit products owned by others" },
      { key: PERMISSIONS.CATEGORY_MANAGE, label: "Manage categories" },
      { key: PERMISSIONS.BRAND_MANAGE, label: "Manage brands" },
      { key: PERMISSIONS.ATTRIBUTE_MANAGE, label: "Manage attributes & variants" },
      { key: PERMISSIONS.INVENTORY_MANAGE, label: "Manage inventory" },
      { key: PERMISSIONS.INVENTORY_VIEW, label: "View stock levels & reports" },
      { key: PERMISSIONS.INVENTORY_ADJUST, label: "Adjust stock (damage, counts, transfers)" },
      { key: PERMISSIONS.INVENTORY_RECEIVE, label: "Record incoming supplier stock" },
      { key: PERMISSIONS.WAREHOUSE_MANAGE, label: "Manage warehouses" },
    ],
  },
  {
    group: "Orders",
    permissions: [
      { key: PERMISSIONS.ORDER_VIEW, label: "View orders" },
      { key: PERMISSIONS.ORDER_UPDATE_STATUS, label: "Change order status" },
      { key: PERMISSIONS.ORDER_CANCEL, label: "Cancel orders" },
      { key: PERMISSIONS.ORDER_REFUND, label: "Refunds & returns" },
      { key: PERMISSIONS.ORDER_INTERNAL_NOTE, label: "Read/write internal notes" },
      { key: PERMISSIONS.ORDER_VIEW_CONTACT, label: "See full customer contact details" },
      { key: PERMISSIONS.ORDER_CUSTOMER_SEARCH, label: "Operational phone/email history search" },
      { key: PERMISSIONS.ORDER_FRAUD_REVIEW, label: "Fraud review queue" },
      { key: PERMISSIONS.ORDER_INVOICE, label: "Download invoices" },
    ],
  },
  {
    group: "Internal tokens",
    permissions: [
      { key: PERMISSIONS.TOKEN_VIEW, label: "View tokens" },
      { key: PERMISSIONS.TOKEN_CREATE, label: "Raise tokens" },
      { key: PERMISSIONS.TOKEN_ASSIGN, label: "Assign tokens to staff" },
      { key: PERMISSIONS.TOKEN_CLOSE, label: "Resolve and close tokens" },
    ],
  },
  {
    group: "People",
    permissions: [
      { key: PERMISSIONS.CUSTOMER_VIEW, label: "View customers" },
      { key: PERMISSIONS.CUSTOMER_UPDATE, label: "Edit customers" },
      { key: PERMISSIONS.STAFF_VIEW, label: "View staff" },
      { key: PERMISSIONS.STAFF_MANAGE, label: "Create / suspend staff" },
      { key: PERMISSIONS.ROLE_MANAGE, label: "Edit role permissions" },
    ],
  },
  {
    group: "Marketing",
    permissions: [
      { key: PERMISSIONS.COUPON_MANAGE, label: "Manage coupons" },
      { key: PERMISSIONS.OFFER_MANAGE, label: "Manage offers" },
      { key: PERMISSIONS.FLASH_SALE_MANAGE, label: "Manage flash sales" },
      { key: PERMISSIONS.BANNER_MANAGE, label: "Manage banners & ads" },
    ],
  },
  {
    group: "Content & support",
    permissions: [
      { key: PERMISSIONS.REVIEW_MODERATE, label: "Moderate reviews" },
      { key: PERMISSIONS.MESSAGE_VIEW, label: "View support conversations" },
      { key: PERMISSIONS.MESSAGE_REPLY, label: "Reply to customers" },
      { key: PERMISSIONS.NOTIFICATION_SEND, label: "Send notifications" },
      { key: PERMISSIONS.CONTENT_MANAGE, label: "Manage pages, FAQ & homepage" },
      { key: PERMISSIONS.NAVIGATION_MANAGE, label: "Manage navigation & footer" },
      { key: PERMISSIONS.BLOG_VIEW, label: "View blog posts" },
      { key: PERMISSIONS.BLOG_WRITE, label: "Write & edit own blog posts" },
      { key: PERMISSIONS.BLOG_PUBLISH, label: "Publish blog posts" },
      { key: PERMISSIONS.BLOG_MANAGE_ALL, label: "Edit anyone's blog posts" },
      { key: PERMISSIONS.BLOG_DELETE, label: "Delete blog posts" },
    ],
  },
  {
    group: "Platform",
    permissions: [
      { key: PERMISSIONS.SETTINGS_MANAGE, label: "Business settings & feature flags" },
      { key: PERMISSIONS.SEO_MANAGE, label: "SEO / GEO / AEO settings" },
      { key: PERMISSIONS.ANALYTICS_MANAGE, label: "Analytics & tracking" },
      { key: PERMISSIONS.SHIPPING_MANAGE, label: "Delivery charges & districts" },
      { key: PERMISSIONS.COURIER_MANAGE, label: "Courier integrations" },
      { key: PERMISSIONS.COURIER_DISPATCH, label: "Send parcels to the courier" },
      { key: PERMISSIONS.COURIER_SETTLEMENT, label: "Record courier settlements" },
      { key: PERMISSIONS.PAYMENT_MANAGE, label: "Payment integrations" },
      { key: PERMISSIONS.REPORT_VIEW, label: "Reports" },
      { key: PERMISSIONS.AUDIT_VIEW, label: "Audit & security logs" },
    ],
  },
  {
    group: "Accounts & finance",
    permissions: [
      { key: PERMISSIONS.FINANCE_VIEW, label: "View accounts, P&L and cash flow" },
      { key: PERMISSIONS.FINANCE_MANAGE, label: "Record income & expenses" },
      { key: PERMISSIONS.FINANCE_VOID, label: "Void posted transactions" },
      { key: PERMISSIONS.FINANCE_EXPORT, label: "Export financial data" },
    ],
  },
  {
    group: "AI automation",
    permissions: [
      { key: PERMISSIONS.AI_USE, label: "Generate product drafts with AI" },
      { key: PERMISSIONS.AI_CONFIGURE, label: "Configure AI providers" },
    ],
  },
];

/** Defaults written to `role_permissions` by the seed. Super Admin bypasses this map entirely. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<Role, "SUPER_ADMIN" | "CUSTOMER">, Permission[]> = {
  ADMIN: [
    PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_UPDATE, PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_PUBLISH, PERMISSIONS.PRODUCT_MANAGE_ALL,
    PERMISSIONS.CATEGORY_MANAGE, PERMISSIONS.BRAND_MANAGE, PERMISSIONS.ATTRIBUTE_MANAGE, PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_UPDATE_STATUS, PERMISSIONS.ORDER_CANCEL, PERMISSIONS.ORDER_REFUND,
    PERMISSIONS.ORDER_INTERNAL_NOTE, PERMISSIONS.ORDER_VIEW_CONTACT, PERMISSIONS.ORDER_CUSTOMER_SEARCH,
    PERMISSIONS.ORDER_FRAUD_REVIEW, PERMISSIONS.ORDER_INVOICE,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_UPDATE, PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.COUPON_MANAGE, PERMISSIONS.OFFER_MANAGE, PERMISSIONS.FLASH_SALE_MANAGE, PERMISSIONS.BANNER_MANAGE,
    PERMISSIONS.REVIEW_MODERATE, PERMISSIONS.MESSAGE_VIEW, PERMISSIONS.MESSAGE_REPLY, PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.NAVIGATION_MANAGE,
    PERMISSIONS.BLOG_VIEW, PERMISSIONS.BLOG_WRITE, PERMISSIONS.BLOG_PUBLISH,
    PERMISSIONS.BLOG_MANAGE_ALL, PERMISSIONS.BLOG_DELETE,
    PERMISSIONS.SEO_MANAGE, PERMISSIONS.SHIPPING_MANAGE, PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.TOKEN_VIEW, PERMISSIONS.TOKEN_CREATE, PERMISSIONS.TOKEN_ASSIGN, PERMISSIONS.TOKEN_CLOSE,
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ADJUST, PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.WAREHOUSE_MANAGE,
    PERMISSIONS.COURIER_DISPATCH, PERMISSIONS.COURIER_SETTLEMENT,
    // The books are readable and writable by an admin, but voiding a posted
    // entry is the owner's call — that is how a mistake gets hidden.
    PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_MANAGE, PERMISSIONS.FINANCE_EXPORT,
    PERMISSIONS.AI_USE,
  ],
  MODERATOR: [
    PERMISSIONS.PRODUCT_VIEW,
    // Builds the catalogue, but an admin decides what goes live, and only
    // their own products are editable (no PRODUCT_MANAGE_ALL).
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.ORDER_VIEW,
    // Moderators run the day-to-day order desk, so they move orders through
    // the workflow; refunds and cancellations stay with an admin.
    PERMISSIONS.ORDER_UPDATE_STATUS,
    PERMISSIONS.ORDER_INTERNAL_NOTE,
    PERMISSIONS.ORDER_INVOICE,
    PERMISSIONS.REVIEW_MODERATE,
    PERMISSIONS.MESSAGE_VIEW,
    PERMISSIONS.MESSAGE_REPLY,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.TOKEN_VIEW,
    PERMISSIONS.TOKEN_CREATE,
    // Sees what is in stock so they can answer "do you have this?", but
    // cannot move stock or see what anything cost us.
    PERMISSIONS.INVENTORY_VIEW,
    // Writes articles and edits their own drafts. Publishing is an admin's
    // call, the same way it is for a product.
    PERMISSIONS.BLOG_VIEW,
    PERMISSIONS.BLOG_WRITE,
  ],
};

export const STAFF_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];

/**
 * Product list tabs. "Draft" is the review queue: a moderator can write a
 * product but not publish it, so an admin needs somewhere obvious to find
 * what is waiting.
 */
export const PRODUCT_TABS = [
  { key: "all", label: "All", statuses: [] as ProductStatus[] },
  { key: "draft", label: "Drafts", statuses: ["DRAFT"] as ProductStatus[] },
  { key: "published", label: "Published", statuses: ["PUBLISHED"] as ProductStatus[] },
  { key: "unpublished", label: "Unpublished", statuses: ["UNPUBLISHED"] as ProductStatus[] },
  { key: "archived", label: "Archived", statuses: ["ARCHIVED"] as ProductStatus[] },
] as const;

/**
 * Staff list tabs: one per role, plus the account states that need chasing.
 * A suspended or blocked account is easy to forget about in a mixed list.
 */
export const STAFF_TABS = [
  { key: "all", label: "All staff", roles: [] as Role[], status: null },
  { key: "super-admin", label: "Super Admin", roles: ["SUPER_ADMIN"] as Role[], status: null },
  { key: "admin", label: "Admins", roles: ["ADMIN"] as Role[], status: null },
  { key: "moderator", label: "Moderators", roles: ["MODERATOR"] as Role[], status: null },
  { key: "customers", label: "Customers", roles: ["CUSTOMER"] as Role[], status: null },
  { key: "active", label: "Active", roles: [] as Role[], status: "ACTIVE" as const },
  { key: "suspended", label: "Suspended", roles: [] as Role[], status: "SUSPENDED" as const },
  { key: "blocked", label: "Blocked", roles: [] as Role[], status: "BLOCKED" as const },
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  CUSTOMER: "Customer",
};

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/* ==========================================================================
   ORDER LIFECYCLE
   ========================================================================== */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
  FAILED: "Failed",
  FRAUD_REVIEW: "Fraud review",
};

/**
 * Order queues, grouped by what a staff member is actually doing.
 *
 * A single mixed list makes the common job — find today's confirmed orders and
 * pack them — a hunt through cancellations and fraud holds. Each tab is one
 * task: needs attention, needs packing, on the way, done, or written off.
 */
export const ORDER_QUEUES = [
  { key: "all", label: "All orders", statuses: [] as OrderStatus[] },
  { key: "new", label: "Needs review", statuses: ["PENDING"] as OrderStatus[] },
  {
    key: "to-pack",
    label: "To pack",
    statuses: ["CONFIRMED", "PROCESSING"] as OrderStatus[],
  },
  {
    key: "in-transit",
    label: "In transit",
    statuses: ["PACKED", "SHIPPED", "OUT_FOR_DELIVERY"] as OrderStatus[],
  },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"] as OrderStatus[] },
  { key: "flagged", label: "Fraud review", statuses: ["FRAUD_REVIEW"] as OrderStatus[] },
  {
    key: "closed",
    label: "Cancelled & returned",
    statuses: ["CANCELLED", "REJECTED", "RETURNED", "REFUNDED", "FAILED"] as OrderStatus[],
  },
] as const;

export type OrderQueueKey = (typeof ORDER_QUEUES)[number]["key"];

export function orderQueueByKey(key: string | undefined) {
  return ORDER_QUEUES.find((queue) => queue.key === key) ?? ORDER_QUEUES[0];
}

/** Valid state machine — enforced server-side on every status change. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "PROCESSING", "CANCELLED", "REJECTED", "FRAUD_REVIEW", "FAILED"],
  CONFIRMED: ["PROCESSING", "PACKED", "CANCELLED", "REJECTED", "FRAUD_REVIEW"],
  PROCESSING: ["PACKED", "SHIPPED", "CANCELLED", "FRAUD_REVIEW"],
  PACKED: ["SHIPPED", "CANCELLED", "FRAUD_REVIEW"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED", "REJECTED", "FAILED"],
  DELIVERED: ["RETURNED", "REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REJECTED: ["RETURNED", "REFUNDED"],
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
  FAILED: ["PENDING", "CANCELLED"],
  FRAUD_REVIEW: ["CONFIRMED", "REJECTED", "CANCELLED"],
};

/** Statuses that release reserved stock back to inventory. */
export const STOCK_RELEASING_STATUSES: OrderStatus[] = ["CANCELLED", "REJECTED", "RETURNED", "FAILED"];

/**
 * Statuses at which the goods have physically left the building.
 *
 * Reaching one of these consumes the reservation: the units stop being
 * "promised" and simply stop being ours. Reaching a stock-releasing status
 * instead cancels the reservation and puts the units back on sale.
 */
export const STOCK_DESPATCHED_STATUSES: OrderStatus[] = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

/** True while an order's units are still counted as reserved. */
export function holdsReservation(status: OrderStatus): boolean {
  return !STOCK_RELEASING_STATUSES.includes(status) && !STOCK_DESPATCHED_STATUSES.includes(status);
}

/** Statuses a customer is allowed to cancel from. */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED"];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PENDING: "Pending",
  PAID: "Paid",
  PARTIALLY_PAID: "Partially paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  CANCELLED: "Cancelled",
};

/** CSS class from globals.css for a lifecycle value. */
export function statusClass(status: string): string {
  return `status-${status.toLowerCase()}`;
}

/* ==========================================================================
   SETTINGS KEYS — the no-code control surface
   ========================================================================== */

export const SETTING_KEYS = {
  SITE: "site",
  CONTACT: "contact",
  SOCIAL: "social",
  FEATURES: "features",
  THEME: "theme",
  SEO: "seo",
  ANALYTICS: "analytics",
  SHIPPING: "shipping",
  PAYMENT: "payment",
  AI: "ai",
  INVENTORY: "inventory",
  COURIER: "courier",
  FINANCE: "finance",
  SECURITY: "security",
  REVIEW_POLICY: "review_policy",
  UPLOAD: "upload",
} as const;

export const UPLOAD_DEFAULTS = {
  maxFileSizeMb: 5,
  recommendedProductImage: "1200 × 1200 px (square)",
  recommendedBanner: "1920 × 640 px",
  recommendedCategoryImage: "600 × 600 px",
  acceptedFormats: ["image/jpeg", "image/png", "image/webp", "image/avif"],
} as const;

export const PAGE_SIZES = { storefront: 24, dashboard: 20, compact: 10 } as const;
