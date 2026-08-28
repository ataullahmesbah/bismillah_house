import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { Field, PageHeader, StatusPill } from "@/components/ui";
import { staffReplyAction, updateConversationAction } from "@/app/actions/dashboard/engagement";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { cn, formatDateTime, shopTeamName } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function StaffConversationPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requirePermissionPage(PERMISSIONS.MESSAGE_VIEW, "/dashboard/messages");
  const teamName = shopTeamName((await getSettings()).site.siteName);

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true, subject: true, status: true, priority: true, assignedToId: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      guestName: true, guestEmail: true,
      order: { select: { id: true, orderNumber: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, senderName: true, senderRole: true, isInternal: true, createdAt: true },
      },
    },
  });

  if (!conversation) notFound();

  const [staff, canReply] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MODERATOR"] }, status: "ACTIVE", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    userHasPermission(user, PERMISSIONS.MESSAGE_REPLY),
  ]);

  await prisma.conversation
    .update({ where: { id: conversation.id }, data: { unreadForStaff: false } })
    .catch(() => undefined);

  return (
    <>
      <PageHeader
        title={conversation.subject}
        description={
          conversation.customer
            ? `${conversation.customer.name} · ${conversation.customer.email}`
            : `${conversation.guestName ?? "Guest"} · ${conversation.guestEmail ?? "no email"}`
        }
        action={<Link href="/dashboard/messages" className="btn-ghost btn-sm">← All messages</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Conversation</h2>
            <StatusPill status={conversation.status} />
          </div>

          <div className="card-body stack">
            {conversation.messages.map((message) => {
              const isStaff = message.senderRole === "STAFF";
              return (
                <div key={message.id} className={cn("flex", isStaff ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-[var(--radius-tm-lg)] px-4 py-3 text-sm",
                      message.isInternal
                        ? "border border-dashed border-warning-500 bg-warning-50 text-warning-700"
                        : isStaff
                          ? "bg-brand-900 text-white"
                          : "bg-surface-muted text-brand-800",
                    )}
                  >
                    <p className={cn("text-xs font-semibold", message.isInternal ? "text-warning-700" : isStaff ? "text-brand-300" : "text-brand-500")}>
                      {message.senderName}
                      {message.isInternal ? " · internal note" : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p>
                    <p className={cn("mt-1.5 text-[0.6875rem]", isStaff && !message.isInternal ? "text-brand-400" : "text-brand-400")}>
                      {formatDateTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {canReply ? (
            <ActionForm action={staffReplyAction} className="card-footer flex-col items-stretch gap-2 bg-white">
              <input type="hidden" name="conversationId" value={conversation.id} />
              <textarea name="body" className="textarea" rows={3} required maxLength={4000} placeholder="Write a reply…" />
              <div className="row-between">
                <label className="flex items-center gap-2 text-xs font-medium text-brand-600">
                  <input type="checkbox" name="isInternal" className="checkbox" />
                  Internal note (never shown to the customer)
                </label>
                <span className="muted-xs hidden sm:inline">
                  Customers see replies from {teamName}, not your name
                </span>
                <SubmitButton>Send</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <div className="card-footer"><p className="muted-xs">You do not have permission to reply.</p></div>
          )}
        </section>

        <aside className="stack">
          <ActionForm action={updateConversationAction} className="card">
            <div className="card-header"><h2 className="card-title">Manage</h2></div>
            <div className="card-body stack">
              <input type="hidden" name="id" value={conversation.id} />
              <Field label="Status" htmlFor="status">
                <select id="status" name="status" className="select" defaultValue={conversation.status}>
                  <option value="OPEN">Open</option>
                  <option value="PENDING">Awaiting customer</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </Field>
              <Field label="Assigned to" htmlFor="assignedToId">
                <select id="assignedToId" name="assignedToId" className="select" defaultValue={conversation.assignedToId ?? ""}>
                  <option value="">Unassigned</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="card-footer">
              <SubmitButton className="btn-secondary">Update</SubmitButton>
            </div>
          </ActionForm>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Customer</h2></div>
            <div className="card-body space-y-1.5 text-sm text-brand-600">
              {conversation.customer ? (
                <>
                  <p className="font-semibold text-brand-900">{conversation.customer.name}</p>
                  <p>{conversation.customer.email}</p>
                  <p>{conversation.customer.phone ?? "No phone"}</p>
                  <Link href={`/dashboard/customers/${conversation.customer.id}`} className="btn-secondary btn-xs mt-2">
                    Customer profile
                  </Link>
                </>
              ) : (
                <p>{conversation.guestName ?? "Guest"} · {conversation.guestEmail ?? "no email"}</p>
              )}
              {conversation.order ? (
                <Link href={`/dashboard/orders/${conversation.order.id}`} className="btn-ghost btn-xs mt-2">
                  Order {conversation.order.orderNumber}
                </Link>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
