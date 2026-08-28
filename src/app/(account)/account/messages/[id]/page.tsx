import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, StatusPill } from "@/components/ui";
import { ConversationReplyForm } from "@/components/site/account-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatDateTime, shopTeamName } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Conversation", path: "/account/messages", noIndex: true });
}

export default async function ConversationPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser();

  // Scoped by customerId so a conversation id from elsewhere simply 404s.
  const conversation = await prisma.conversation.findFirst({
    where: { id, customerId: user.id, deletedAt: null },
    select: {
      id: true, subject: true, status: true,
      order: { select: { id: true, orderNumber: true } },
      messages: {
        // Internal staff notes are never exposed to the customer.
        where: { isInternal: false, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, senderName: true, senderRole: true, createdAt: true },
      },
    },
  });

  if (!conversation) notFound();

  // Staff replies are signed with the shop rather than the individual.
  const teamName = shopTeamName((await getSettings()).site.siteName);

  await prisma.conversation
    .update({ where: { id: conversation.id }, data: { unreadForCustomer: false } })
    .catch(() => undefined);

  return (
    <>
      <PageHeader
        title={conversation.subject}
        description={conversation.order ? `About order ${conversation.order.orderNumber}` : undefined}
        action={<Link href="/account/messages" className="btn-ghost btn-sm">← All messages</Link>}
      />

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Conversation</h2>
          <StatusPill status={conversation.status} />
        </div>

        <div className="card-body stack">
          {conversation.messages.map((message) => {
            const mine = message.senderRole === "CUSTOMER";
            return (
              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-[var(--radius-tm-lg)] px-4 py-3 text-sm",
                    mine ? "bg-brand-900 text-white" : "bg-surface-muted text-brand-800",
                  )}
                >
                  <p className={cn("text-xs font-semibold", mine ? "text-brand-300" : "text-brand-500")}>
                    {mine ? "You" : teamName}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p>
                  <p className={cn("mt-1.5 text-[0.6875rem]", mine ? "text-brand-400" : "text-brand-400")}>
                    {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <ConversationReplyForm conversationId={conversation.id} />
      </div>
    </>
  );
}
