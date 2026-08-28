import { PERMISSIONS, type Permission } from "@/lib/constants";

/**
 * Dashboard navigation. Each entry declares the permission(s) that make it
 * visible — the same permissions the server re-checks on the page itself, so
 * hiding a link is a convenience, never the security boundary.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Visible when the user holds ANY of these. Empty = every staff member. */
  permissions: Permission[];
  exact?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const DASHBOARD_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", permissions: [], exact: true }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/dashboard/products", label: "Products", permissions: [PERMISSIONS.PRODUCT_VIEW] },
      { href: "/dashboard/products/ai", label: "AI drafting", permissions: [PERMISSIONS.AI_USE] },
      { href: "/dashboard/categories", label: "Categories", permissions: [PERMISSIONS.CATEGORY_MANAGE] },
      { href: "/dashboard/brands", label: "Brands", permissions: [PERMISSIONS.BRAND_MANAGE] },
      { href: "/dashboard/attributes", label: "Attributes & variants", permissions: [PERMISSIONS.ATTRIBUTE_MANAGE] },
      {
        href: "/dashboard/inventory",
        label: "Inventory",
        permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/dashboard/orders", label: "Orders", permissions: [PERMISSIONS.ORDER_VIEW] },
      { href: "/dashboard/orders/fraud-review", label: "Fraud review", permissions: [PERMISSIONS.ORDER_FRAUD_REVIEW] },
      { href: "/dashboard/customer-search", label: "Customer history", permissions: [PERMISSIONS.ORDER_CUSTOMER_SEARCH] },
      { href: "/dashboard/customers", label: "Customers", permissions: [PERMISSIONS.CUSTOMER_VIEW] },
      {
        href: "/dashboard/courier",
        label: "Courier & delivery",
        permissions: [PERMISSIONS.COURIER_DISPATCH, PERMISSIONS.COURIER_MANAGE],
      },
    ],
  },
  {
    label: "Accounts & finance",
    items: [
      { href: "/dashboard/finance", label: "Overview", permissions: [PERMISSIONS.FINANCE_VIEW], exact: true },
      { href: "/dashboard/finance/transactions", label: "Transactions", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/expenses", label: "Expenses", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/profit-loss", label: "Profit & loss", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/cash-flow", label: "Cash flow", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/accounts", label: "Accounts", permissions: [PERMISSIONS.FINANCE_MANAGE] },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/dashboard/coupons", label: "Coupons", permissions: [PERMISSIONS.COUPON_MANAGE] },
      { href: "/dashboard/offers", label: "Offers", permissions: [PERMISSIONS.OFFER_MANAGE] },
      { href: "/dashboard/flash-sales", label: "Flash sales", permissions: [PERMISSIONS.FLASH_SALE_MANAGE] },
      { href: "/dashboard/banners", label: "Banners & ads", permissions: [PERMISSIONS.BANNER_MANAGE] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/dashboard/reviews", label: "Reviews", permissions: [PERMISSIONS.REVIEW_MODERATE] },
      { href: "/dashboard/messages", label: "Messages", permissions: [PERMISSIONS.MESSAGE_VIEW] },
      { href: "/dashboard/leads", label: "Contact leads", permissions: [PERMISSIONS.MESSAGE_VIEW] },
      // Every staff member has notifications; only sending a broadcast is
      // gated, and the page itself hides that panel when unpermitted.
      { href: "/dashboard/notifications", label: "Notifications", permissions: [] },
      { href: "/dashboard/tokens", label: "Tokens", permissions: [PERMISSIONS.TOKEN_VIEW] },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/dashboard/content/home", label: "Homepage sections", permissions: [PERMISSIONS.CONTENT_MANAGE] },
      { href: "/dashboard/content/pages", label: "Pages & policies", permissions: [PERMISSIONS.CONTENT_MANAGE] },
      { href: "/dashboard/content/faq", label: "FAQ", permissions: [PERMISSIONS.CONTENT_MANAGE] },
      { href: "/dashboard/content/navigation", label: "Navigation & footer", permissions: [PERMISSIONS.NAVIGATION_MANAGE] },
      { href: "/dashboard/content/testimonials", label: "Testimonials", permissions: [PERMISSIONS.CONTENT_MANAGE] },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/reports", label: "Reports", permissions: [PERMISSIONS.REPORT_VIEW] },
      { href: "/dashboard/audit-logs", label: "Audit & security", permissions: [PERMISSIONS.AUDIT_VIEW] },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/dashboard/settings", label: "Business settings", permissions: [PERMISSIONS.SETTINGS_MANAGE], exact: true },
      { href: "/dashboard/settings/operations", label: "Inventory & finance", permissions: [PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/settings/shipping", label: "Delivery & districts", permissions: [PERMISSIONS.SHIPPING_MANAGE] },
      { href: "/dashboard/settings/payments", label: "Payments", permissions: [PERMISSIONS.PAYMENT_MANAGE, PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/settings/courier", label: "Courier", permissions: [PERMISSIONS.COURIER_MANAGE, PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/settings/seo", label: "SEO / GEO / AEO", permissions: [PERMISSIONS.SEO_MANAGE] },
      { href: "/dashboard/settings/analytics", label: "Analytics & tracking", permissions: [PERMISSIONS.ANALYTICS_MANAGE, PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/staff", label: "Staff & roles", permissions: [PERMISSIONS.STAFF_VIEW] },
    ],
  },
];
