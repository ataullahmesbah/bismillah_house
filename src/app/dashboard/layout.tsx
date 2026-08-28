import Link from "next/link";

import { DashboardShell, SidebarTrigger } from "@/components/dashboard/shell";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { requireStaffPage } from "@/lib/auth/guards";
import { getEffectivePermissions } from "@/lib/auth/rbac";
import { DASHBOARD_NAV } from "@/lib/dashboard-nav";
import { getSettings } from "@/lib/settings";
import { recentNotifications, unreadNotificationCount } from "@/lib/notifications";
import { openTokenCountFor } from "@/lib/services/tokens";
import { NotificationBell } from "@/components/site/notification-bell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  const [permissions, settings, unread, notifications, openTokens] = await Promise.all([
    getEffectivePermissions(user.id, user.role),
    getSettings(),
    unreadNotificationCount(user.id, true),
    recentNotifications(user.id, true),
    openTokenCountFor(user.id),
  ]);

  // Only groups with at least one permitted item are rendered.
  const groups = DASHBOARD_NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.permissions.length === 0 || item.permissions.some((permission) => permissions.has(permission)),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <DashboardShell>
    <div className="flex min-h-dvh bg-surface-muted">
      <DashboardSidebar
        groups={groups}
        user={{ name: user.name, role: user.role }}
        siteName={settings.site.siteName}
        badges={openTokens > 0 ? { "/dashboard/tokens": openTokens } : undefined}
      />

      <div className="flex  min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <SidebarTrigger />

            {/* Identity, then a quick jump to raising a token — the two things
                staff reach for from any page. */}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-brand-900">{user.name}</p>
              <p className="text-xs capitalize leading-tight text-brand-500">
                {user.role.replace("_", " ").toLowerCase()}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {openTokens > 0 ? (
                <Link href="/dashboard/tokens?view=mine" className="btn-alt-soft btn-sm hidden sm:inline-flex">
                  {openTokens} token{openTokens === 1 ? "" : "s"} for you
                </Link>
              ) : null}
              <NotificationBell
                notifications={notifications}
                unreadCount={unread}
                seeAllHref="/dashboard/notifications"
              />
              <Link href="/" className="btn-secondary btn-sm hidden sm:inline-flex">Storefront</Link>
            </div>
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </DashboardShell>
  );
}
