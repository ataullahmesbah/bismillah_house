import Link from "next/link";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { sendBroadcastAction } from "@/app/actions/dashboard/engagement";
import { markNotificationsReadAction } from "@/app/actions/account";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { cn, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardNotificationsPage() {
  const user = await requireStaffPage();
  const canSend = await userHasPermission(user, PERMISSIONS.NOTIFICATION_SEND);

  const notifications = await prisma.notification.findMany({
    where: { OR: [{ userId: user.id }, { audience: "STAFF", userId: null }, { audience: "ALL", userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, title: true, body: true, url: true, isRead: true, createdAt: true, audience: true },
  });

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <>
      <PageHeader title="Notifications" description="Staff alerts, plus broadcasts to your customers." />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent notifications</h2>
            {unreadCount > 0 ? (
              <QuickActionForm
                action={markNotificationsReadAction}
                values={{}}
                label={`Mark all read (${unreadCount})`}
                className="btn-secondary btn-xs"
              />
            ) : (
              <span className="muted-xs">All caught up</span>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="card-body">
              <EmptyState title="Nothing yet" description="New orders, reviews and messages will show up here." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((notification) => {
                const content = (
                  <>
                    <div className="row-between gap-3">
                      <p className={cn("text-sm", notification.isRead ? "font-medium text-brand-700" : "font-bold text-brand-950")}>
                        {notification.title}
                      </p>
                      <span className="badge-outline shrink-0">{notification.audience}</span>
                    </div>
                    {notification.body ? <p className="mt-0.5 text-sm text-brand-600">{notification.body}</p> : null}
                    <p className="muted-xs mt-1">{relativeTime(notification.createdAt)}</p>
                  </>
                );
                return (
                  <li key={notification.id} className={cn("p-4", !notification.isRead && "bg-surface-muted/60")}>
                    {notification.url ? <Link href={notification.url} className="block hover:opacity-80">{content}</Link> : content}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canSend ? (
          <ActionForm action={sendBroadcastAction} className="card lg:sticky lg:top-20 lg:self-start">
            <div className="card-header"><h2 className="card-title">Send a notification</h2></div>
            <div className="card-body stack">
              <Field label="Audience" htmlFor="audience" required>
                <select id="audience" name="audience" className="select" defaultValue="ALL_CUSTOMERS">
                  <option value="ALL_CUSTOMERS">All active customers</option>
                  <option value="STAFF">Staff only</option>
                </select>
              </Field>
              <Field label="Title" htmlFor="title" required errorFor="title">
                <input id="title" name="title" className="input" required maxLength={200} />
              </Field>
              <Field label="Message" htmlFor="body" errorFor="body">
                <textarea id="body" name="body" className="textarea min-h-20" maxLength={1000} />
              </Field>
              <Field label="Link" htmlFor="url" hint="Optional path, e.g. /shop?sort=featured">
                <input id="url" name="url" className="input" maxLength={500} />
              </Field>
            </div>
            <div className="card-footer">
              <SubmitButton>Send notification</SubmitButton>
            </div>
          </ActionForm>
        ) : null}
      </div>
    </>
  );
}
