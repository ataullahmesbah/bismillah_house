import Link from "next/link";
import Image from "next/image";

import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getSiteNavigation } from "@/lib/services/navigation";
import { getCartCount } from "@/lib/services/cart";
import { isStaffRole } from "@/lib/constants";
import { recentNotifications, unreadNotificationCount } from "@/lib/notifications";
import { CartDrawer } from "./cart-drawer";
import { NotificationBell } from "./notification-bell";
import { SearchBar } from "./search-bar";
import { MobileNav } from "./mobile-nav";
import { MegaMenu } from "./mega-menu";

/**
 * Storefront header. Logo, announcement bar, menu items and contact number all
 * come from the database so the owner can change them without a deploy.
 */
export async function SiteHeader() {
  const [settings, navigation, user, cartCount] = await Promise.all([
    getSettings(),
    getSiteNavigation(),
    getCurrentUser(),
    getCartCount(),
  ]);

  const staff = user ? isStaffRole(user.role) : false;
  const [notificationCount, notifications] = user
    ? await Promise.all([
        unreadNotificationCount(user.id, staff),
        recentNotifications(user.id, staff),
      ])
    : [0, []];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      {settings.site.announcementEnabled && settings.site.announcement ? (
        <div className="bg-brand-900 text-white">
          <div className="tm-container flex min-h-9 items-center justify-center gap-2 py-1.5 text-center text-xs font-medium">
            {settings.site.announcementLink ? (
              <Link href={settings.site.announcementLink} className="hover:underline">
                {settings.site.announcement}
              </Link>
            ) : (
              <span>{settings.site.announcement}</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="tm-container">
        <div className="flex h-16 items-center gap-3">
          <MobileNav items={navigation.main} isAuthenticated={Boolean(user)} isStaff={staff} />

          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={settings.site.siteName}>
            {settings.site.logoUrl ? (
              <Image
                src={settings.site.logoUrl}
                alt={settings.site.siteName}
                width={140}
                height={36}
                className="h-9 w-auto object-contain"
                preload
                fetchPriority="high"
              />
            ) : (
              <span className="text-lg font-extrabold tracking-tight text-brand-950">
                {settings.site.siteName}
              </span>
            )}
          </Link>

          <div className="ml-2 hidden min-w-0 flex-1 md:block">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {user ? (
              <NotificationBell notifications={notifications} unreadCount={notificationCount} />
            ) : null}

            <CartDrawer initialCount={cartCount} />

            {user ? (
              <div className="hidden items-center gap-1.5 sm:flex">
                {isStaffRole(user.role) ? (
                  <Link href="/dashboard" className="btn-secondary btn-sm">Dashboard</Link>
                ) : null}
                <Link href="/account" className="btn-primary btn-sm">
                  {user.name.split(" ")[0]}
                </Link>
              </div>
            ) : (
              <div className="hidden items-center gap-1.5 sm:flex">
                <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
                <Link href="/register" className="btn-primary btn-sm">Register</Link>
              </div>
            )}
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <SearchBar />
        </div>

        <div className="hidden h-11 items-center justify-between border-t border-line lg:flex">
          <MegaMenu items={navigation.main} />
          <div className="flex items-center gap-4 text-xs font-medium text-brand-500">
            <Link href="/track-order" className="hover:text-brand-900">Track order</Link>
            <Link href="/help" className="hover:text-brand-900">Help centre</Link>
            {settings.contact.phone ? (
              <a href={`tel:${settings.contact.phone}`} className="font-semibold text-brand-900">
                {settings.contact.phone}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
