/**
 * Sidebar icons.
 *
 * These are hand-drawn rather than pulled from an icon package. A dependency
 * would ship a runtime and a barrel file for what is, in the end, forty short
 * strings of path data — and every one of them is rendered on the server into
 * static markup, so the browser never pays for a library at all.
 *
 * All paths are drawn on a 24×24 grid and stroked, never filled, so a single
 * `currentColor` follows the rail's active and hover states without any extra
 * rules. Add a new icon by adding a key here and naming it on the nav item.
 */

export type IconName = keyof typeof PATHS;

/**
 * Path data only. Everything shared — size, stroke, joins — lives on the
 * wrapping `<svg>`, so an icon cannot drift out of step with the others.
 */
const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  products: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /></>,
  sparkles: <><path d="M12 3.5 13.7 8.3 18.5 10 13.7 11.7 12 16.5 10.3 11.7 5.5 10 10.3 8.3z" /><path d="M18.5 15.5v4" /><path d="M16.5 17.5h4" /></>,
  categories: <><path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h3.6l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" /></>,
  brands: <><circle cx="12" cy="9.5" r="5" /><path d="M8.5 13.8 7 21l5-2.5L17 21l-1.5-7.2" /></>,
  attributes: <><path d="M5 6h14" /><path d="M5 12h14" /><path d="M5 18h14" /><circle cx="9" cy="6" r="1.9" /><circle cx="15" cy="12" r="1.9" /><circle cx="8" cy="18" r="1.9" /></>,
  inventory: <><path d="M3.5 9.5 12 4l8.5 5.5V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" /><rect x="9" y="13" width="6" height="8" rx="1" /></>,
  orders: <><path d="M6 3h12a1 1 0 0 1 1 1v17l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V4a1 1 0 0 1 1-1z" /><path d="M9 8h6" /><path d="M9 12h6" /></>,
  fraud: <><path d="M12 3 20 6v6c0 4.4-3.2 7.8-8 9-4.8-1.2-8-4.6-8-9V6z" /><path d="M12 8.5v4" /><path d="M12 16h.01" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4.5V9H8" /><path d="M12 8v4.4l3 1.8" /></>,
  customers: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6" /><path d="M18 14.6a6.5 6.5 0 0 1 3.5 5.4" /></>,
  courier: <><path d="M2.5 6.5A1 1 0 0 1 3.5 5.5h9a1 1 0 0 1 1 1V16h-11z" /><path d="M13.5 9.5H17l4 3.5V16h-7.5z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  finance: <><path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M3.5 10.5h17" /><path d="M16 15h2" /></>,
  transactions: <><path d="M4 8h13" /><path d="m14 5 3 3-3 3" /><path d="M20 16H7" /><path d="m10 13-3 3 3 3" /></>,
  expenses: <><path d="M5 4h14a1 1 0 0 1 1 1v16l-2.5-1.6L15 21l-2.5-1.6L10 21l-2.5-1.6L5 21V5a1 1 0 0 1 1-1z" /><path d="M9 10h6" /><path d="M9 14h4" /></>,
  profit: <><path d="M3.5 20V4" /><path d="M3.5 20h17" /><path d="m7 15 3.5-4 3 2.5L20 7" /><path d="M16.5 7H20v3.5" /></>,
  cashflow: <><path d="M3 15c2.5-4 4.5-4 7 0s4.5 4 7 0" /><path d="M3 9c2.5-4 4.5-4 7 0s4.5 4 7 0" /><path d="M20.5 9h.01" /><path d="M20.5 15h.01" /></>,
  accounts: <><path d="M3.5 9.5 12 4.5l8.5 5" /><path d="M5.5 10v7" /><path d="M10 10v7" /><path d="M14 10v7" /><path d="M18.5 10v7" /><path d="M3.5 19.5h17" /></>,
  coupons: <><path d="M3.5 8.5A1 1 0 0 1 4.5 7.5h15a1 1 0 0 1 1 1V10a2 2 0 0 0 0 4v1.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4z" /><path d="M13 8v1.5" /><path d="M13 14.5V16" /></>,
  offers: <><path d="M19.5 4.5 4.5 19.5" /><circle cx="8" cy="8" r="2.6" /><circle cx="16" cy="16" r="2.6" /></>,
  flash: <><path d="M13.5 2.5 5 13.5h5.5L10 21.5l8.5-11H13z" /></>,
  banners: <><rect x="3" y="5" width="18" height="14" rx="1.5" /><circle cx="8.5" cy="10" r="1.6" /><path d="m4 17 4.5-4.5 3.5 3.5 3-2.5 5 4.5" /></>,
  reviews: <><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.7 1.1-5.9L3.5 9.7l5.9-.8z" /></>,
  messages: <><path d="M20.5 12a8 8 0 0 1-11.6 7.1L3.5 20.5l1.4-5.4A8 8 0 1 1 20.5 12z" /></>,
  leads: <><path d="M3.5 12.5 5.8 5.4a1 1 0 0 1 1-.7h10.4a1 1 0 0 1 1 .7l2.3 7.1" /><path d="M3.5 12.5H8l1.2 2.5h5.6l1.2-2.5h4.5v5.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" /></>,
  notifications: <><path d="M6 9.5a6 6 0 1 1 12 0c0 3.6 1.5 5 1.5 5H4.5s1.5-1.4 1.5-5z" /><path d="M10 18a2.2 2.2 0 0 0 4 0" /></>,
  tokens: <><circle cx="8.5" cy="12" r="4" /><path d="M12.5 12h8" /><path d="M17 12v3" /><path d="M20.5 12v2.5" /></>,
  blog: <><path d="M4.5 5.5A1 1 0 0 1 5.5 4.5h9a1 1 0 0 1 1 1v13a1 1 0 0 0 1 1H6a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M15.5 8.5H19a1 1 0 0 1 1 1V18a1.5 1.5 0 0 1-1.5 1.5" /><path d="M7.5 8h4.5" /><path d="M7.5 11.5h4.5" /><path d="M7.5 15h3" /></>,
  homepage: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9h18" /><path d="M9 9v11" /></>,
  pages: <><path d="M6 3h7.5L19 8.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M13.5 3v5.5H19" /><path d="M8.5 13h7" /><path d="M8.5 16.5h5" /></>,
  faq: <><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.5a2.4 2.4 0 1 1 3.1 2.6c-.6.2-.8.7-.8 1.3v.3" /><path d="M12 17h.01" /></>,
  navigation: <><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h16" /><path d="M17.5 10.5 21 14l-3.5 3.5" /></>,
  testimonials: <><path d="M9.5 6.5C7 7 5.5 9 5.5 11.5H8a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8 17.5H5.5A1.5 1.5 0 0 1 4 16v-4c0-3.6 2-6.1 5.5-7z" /><path d="M19.5 6.5C17 7 15.5 9 15.5 11.5H18a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 18 17.5h-2.5A1.5 1.5 0 0 1 14 16v-4c0-3.6 2-6.1 5.5-7z" /></>,
  reports: <><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7.5" y="12" width="3" height="5" rx="1" /><rect x="13" y="8" width="3" height="9" rx="1" /><rect x="18" y="5" width="3" height="12" rx="1" /></>,
  audit: <><path d="M12 3 20 6v6c0 4.4-3.2 7.8-8 9-4.8-1.2-8-4.6-8-9V6z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></>,
  // A toothed ring, not a circle with rays — eight separate spokes read as a
  // sun at 16px, which is the size this is always drawn at.
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.1 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  operations: <><path d="M4 7h8" /><path d="M16 7h4" /><path d="M4 17h4" /><path d="M12 17h8" /><circle cx="14" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></>,
  shipping: <><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  payments: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19" /><path d="M6 14.5h3.5" /></>,
  seo: <><circle cx="11" cy="11" r="7" /><path d="M4 11h14" /><path d="M11 4c3.5 3.8 3.5 10.2 0 14" /><path d="M11 4c-3.5 3.8-3.5 10.2 0 14" /><path d="m16.5 16.5 4 4" /></>,
  analytics: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="m7 16 4-5 3 2.5 5.5-7" /><circle cx="11" cy="11" r="1" /><circle cx="14" cy="13.5" r="1" /></>,
  staff: <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="18.5" cy="14.5" r="2.6" /><path d="M18.5 11.4v-1" /><path d="M18.5 18.6v1" /><path d="m21 13-.9.5" /><path d="m16.9 15.5-.9.5" /></>,
  storefront: <><path d="M4 9.5 5.4 5.2a1 1 0 0 1 1-.7h11.2a1 1 0 0 1 1 .7L20 9.5" /><path d="M4 9.5a2.5 2.5 0 0 0 4.7 1 2.5 2.5 0 0 0 4.6 0 2.5 2.5 0 0 0 4.7-1" /><path d="M5.5 11.8V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7.2" /></>,
  account: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  signout: <><path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" /><path d="M10 8.5 6.5 12 10 15.5" /><path d="M6.5 12H15" /></>,
} as const;

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ?? "size-4 shrink-0"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
