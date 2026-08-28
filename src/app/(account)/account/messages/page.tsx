import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { NewConversationForm } from "@/components/site/account-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { relativeTime, shopTeamName, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Messages", path: "/account/messages", noIndex: true });
}

export default async function MessagesPage() {
  const user = await requireUser();
  const settings = await getSettings();
  // Staff replies are signed with the shop, not the individual who wrote them.
  const teamName = shopTeamName(settings.site.siteName);

  const [conversations, orders] = await Promise.all([
    prisma.conversation.findMany({
      where: { customerId: user.id, deletedAt: null },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true, subject: true, status: true, lastMessageAt: true, unreadForCustomer: true,
        order: { select: { orderNumber: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, where: { isInternal: false }, select: { body: true, senderRole: true } },
      },
    }),
    prisma.order.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { placedAt: "desc" },
      take: 20,
      select: { id: true, orderNumber: true },
    }),
  ]);

  if (!settings.features.messagingEnabled) {
    return (
      <>
        <PageHeader title="Messages" />
        <EmptyState
          title="Messaging is currently unavailable"
          description={`Please call us on ${settings.contact.phone} or use the contact form.`}
          action={<Link href="/contact" className="btn-primary">Contact form</Link>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Messages" description="Talk to our support team about any order or product." />

      <div className="mb-4">
        <NewConversationForm orders={orders} />
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="No conversations yet" description="Start one above and our team will reply here." />
      ) : (
        <div className="stack">
          {conversations.map((conversation) => (
            <Link key={conversation.id} href={`/account/messages/${conversation.id}`} className="card-hover p-4">
              <div className="row-between flex-wrap gap-2">
                <p className="text-sm font-bold">
                  {conversation.subject}
                  {conversation.unreadForCustomer ? <span className="badge-red ml-2">New reply</span> : null}
                </p>
                <StatusPill status={conversation.status} />
              </div>
              {conversation.order ? (
                <p className="muted-xs mt-0.5">Order {conversation.order.orderNumber}</p>
              ) : null}
              {conversation.messages[0] ? (
                <p className="mt-1.5 text-sm text-brand-600">
                  <span className="font-medium">
                    {conversation.messages[0].senderRole === "STAFF" ? `${teamName}: ` : "You: "}
                  </span>
                  {truncate(conversation.messages[0].body, 140)}
                </p>
              ) : null}
              <p className="muted-xs mt-1">{relativeTime(conversation.lastMessageAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
