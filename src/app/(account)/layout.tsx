import Link from "next/link";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { AccountNav } from "@/components/site/account-nav";
import { requireUserPage } from "@/lib/auth/guards";
import { unreadNotificationCount } from "@/lib/notifications";
import { isStaffRole } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage("/account");

  const [notifications, unreadMessages] = await Promise.all([
    unreadNotificationCount(user.id, isStaffRole(user.role)),
    prisma.conversation.count({ where: { customerId: user.id, unreadForCustomer: true, deletedAt: null } }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <div className="tm-container section">
          <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
            <div className="stack">
              <div className="card p-4">
                <p className="text-sm font-bold text-brand-950">{user.name}</p>
                <p className="muted-xs truncate">{user.email}</p>
                {isStaffRole(user.role) ? (
                  <Link href="/dashboard" className="btn-secondary btn-sm btn-block mt-3">Staff dashboard</Link>
                ) : null}
              </div>
              <AccountNav notificationCount={notifications} messageCount={unreadMessages} />
            </div>

            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
