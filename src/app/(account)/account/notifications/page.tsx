import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui";
import { MarkAllReadButton } from "@/components/site/account-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { cn, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Notifications", path: "/account/notifications", noIndex: true });
}

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { OR: [{ userId: user.id }, { audience: "ALL", userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, url: true, isRead: true, createdAt: true, type: true },
  });

  const unread = notifications.filter((notification) => !notification.isRead).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You are all caught up."}
        action={unread > 0 ? <MarkAllReadButton /> : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState title="No notifications" description="Order updates and promotions will appear here." />
      ) : (
        <div className="card">
          <ul className="divide-y divide-line">
            {notifications.map((notification) => {
              const content = (
                <>
                  <div className="row-between gap-3">
                    <p className={cn("text-sm", notification.isRead ? "font-medium text-brand-700" : "font-bold text-brand-950")}>
                      {notification.title}
                    </p>
                    {!notification.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger-600" aria-label="Unread" /> : null}
                  </div>
                  {notification.body ? <p className="mt-0.5 text-sm text-brand-600">{notification.body}</p> : null}
                  <p className="muted-xs mt-1">{relativeTime(notification.createdAt)}</p>
                </>
              );

              return (
                <li key={notification.id} className={cn("p-4", !notification.isRead && "bg-surface-muted/60")}>
                  {notification.url ? (
                    <Link href={notification.url} className="block hover:opacity-80">{content}</Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
