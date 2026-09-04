import type { IconName } from "@/components/dashboard/nav-icons";
import { PERMISSIONS, type Permission } from "@/lib/constants";

/**
 * Dashboard navigation. Each entry declares the permission(s) that make it
 * visible — the same permissions the server re-checks on the page itself, so
 * hiding a link is a convenience, never the security boundary.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Key into the sidebar icon set. Every item carries one. */
  icon: IconName;
  /** Visible when the user holds ANY of these. Empty = every staff member. */
  permissions: Permission[];
  exact?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const DASHBOARD_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard", permissions: [], exact: true }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/dashboard/products", label: "Products", icon: "products", permissions: [PERMISSIONS.PRODUCT_VIEW] },
      { href: "/dashboard/products/ai", label: "AI drafting", icon: "sparkles", permissions: [PERMISSIONS.AI_USE] },
      { href: "/dashboard/categories", label: "Categories", icon: "categories", permissions: [PERMISSIONS.CATEGORY_MANAGE] },
      { href: "/dashboard/brands", label: "Brands", icon: "brands", permissions: [PERMISSIONS.BRAND_MANAGE] },
      { href: "/dashboard/attributes", label: "Attributes & variants", icon: "attributes", permissions: [PERMISSIONS.ATTRIBUTE_MANAGE] },
      {
        href: "/dashboard/inventory",
        label: "Inventory",
        icon: "inventory",
        permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/dashboard/orders", label: "Orders", icon: "orders", permissions: [PERMISSIONS.ORDER_VIEW] },
      { href: "/dashboard/orders/fraud-review", label: "Fraud review", icon: "fraud", permissions: [PERMISSIONS.ORDER_FRAUD_REVIEW] },
      { href: "/dashboard/customer-search", label: "Customer history", icon: "history", permissions: [PERMISSIONS.ORDER_CUSTOMER_SEARCH] },
      { href: "/dashboard/customers", label: "Customers", icon: "customers", permissions: [PERMISSIONS.CUSTOMER_VIEW] },
      {
        href: "/dashboard/courier",
        label: "Courier & delivery",
        icon: "courier",
        permissions: [PERMISSIONS.COURIER_DISPATCH, PERMISSIONS.COURIER_MANAGE],
      },
    ],
  },
  {
    label: "Accounts & finance",
    items: [
      { href: "/dashboard/finance", label: "Overview", icon: "finance", permissions: [PERMISSIONS.FINANCE_VIEW], exact: true },
      { href: "/dashboard/finance/transactions", label: "Transactions", icon: "transactions", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/expenses", label: "Expenses", icon: "expenses", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/profit-loss", label: "Profit & loss", icon: "profit", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/cash-flow", label: "Cash flow", icon: "cashflow", permissions: [PERMISSIONS.FINANCE_VIEW] },
      { href: "/dashboard/finance/accounts", label: "Accounts", icon: "accounts", permissions: [PERMISSIONS.FINANCE_MANAGE] },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/dashboard/coupons", label: "Coupons", icon: "coupons", permissions: [PERMISSIONS.COUPON_MANAGE] },
      { href: "/dashboard/offers", label: "Offers", icon: "offers", permissions: [PERMISSIONS.OFFER_MANAGE] },
      { href: "/dashboard/flash-sales", label: "Flash sales", icon: "flash", permissions: [PERMISSIONS.FLASH_SALE_MANAGE] },
      { href: "/dashboard/banners", label: "Banners & ads", icon: "banners", permissions: [PERMISSIONS.BANNER_MANAGE] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/dashboard/reviews", label: "Reviews", icon: "reviews", permissions: [PERMISSIONS.REVIEW_MODERATE] },
      { href: "/dashboard/messages", label: "Messages", icon: "messages", permissions: [PERMISSIONS.MESSAGE_VIEW] },
      { href: "/dashboard/leads", label: "Contact leads", icon: "leads", permissions: [PERMISSIONS.MESSAGE_VIEW] },
      // Every staff member has notifications; only sending a broadcast is
      // gated, and the page itself hides that panel when unpermitted.
      { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", permissions: [] },
      { href: "/dashboard/tokens", label: "Tokens", icon: "tokens", permissions: [PERMISSIONS.TOKEN_VIEW] },
    ],
  },
  {
    label: "Content",
    items: [
      {
        href: "/dashboard/blog",
        label: "Blog",
        icon: "blog",
        permissions: [PERMISSIONS.BLOG_VIEW, PERMISSIONS.BLOG_WRITE],
      },
      { href: "/dashboard/content/home", label: "Homepage sections", icon: "homepage", permissions: [PERMISSIONS.CONTENT_MANAGE] },
      { href: "/dashboard/content/pages", label: "Pages & policies", icon: "pages", permissions: [PERMISSIONS.CONTENT_MANAGE] },
      { href: "/dashboard/content/faq", label: "FAQ", icon: "faq", permissions: [PERMISSIONS.CONTENT_MANAGE] },
      { href: "/dashboard/content/navigation", label: "Navigation & footer", icon: "navigation", permissions: [PERMISSIONS.NAVIGATION_MANAGE] },
      { href: "/dashboard/content/testimonials", label: "Testimonials", icon: "testimonials", permissions: [PERMISSIONS.CONTENT_MANAGE] },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: "reports", permissions: [PERMISSIONS.REPORT_VIEW] },
      { href: "/dashboard/audit-logs", label: "Audit & security", icon: "audit", permissions: [PERMISSIONS.AUDIT_VIEW] },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/dashboard/settings", label: "Business settings", icon: "settings", permissions: [PERMISSIONS.SETTINGS_MANAGE], exact: true },
      { href: "/dashboard/settings/operations", label: "Inventory & finance", icon: "operations", permissions: [PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/settings/shipping", label: "Delivery & districts", icon: "shipping", permissions: [PERMISSIONS.SHIPPING_MANAGE] },
      { href: "/dashboard/settings/payments", label: "Payments", icon: "payments", permissions: [PERMISSIONS.PAYMENT_MANAGE, PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/settings/courier", label: "Courier", icon: "courier", permissions: [PERMISSIONS.COURIER_MANAGE, PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/settings/seo", label: "SEO / GEO / AEO", icon: "seo", permissions: [PERMISSIONS.SEO_MANAGE] },
      { href: "/dashboard/settings/analytics", label: "Analytics & tracking", icon: "analytics", permissions: [PERMISSIONS.ANALYTICS_MANAGE, PERMISSIONS.SETTINGS_MANAGE] },
      { href: "/dashboard/staff", label: "Staff & roles", icon: "staff", permissions: [PERMISSIONS.STAFF_VIEW] },
    ],
  },
];
