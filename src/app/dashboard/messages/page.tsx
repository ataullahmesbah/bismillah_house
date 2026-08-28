import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { buildQuery, parsePositiveInt, relativeTime, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardMessagesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.MESSAGE_VIEW);
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const page = parsePositiveInt(typeof params.page === "string" ? params.page : undefined, 1, 1000);

  const where: Prisma.ConversationWhereInput = {
    deletedAt: null,
    ...(status ? { status: status as "OPEN" | "PENDING" | "RESOLVED" | "CLOSED" } : {}),
  };

  const [conversations, total, counts] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: [{ unreadForStaff: "desc" }, { lastMessageAt: "desc" }],
      skip: (page - 1) * PAGE_SIZES.dashboard,
      take: PAGE_SIZES.dashboard,
      select: {
        id: true, subject: true, status: true, priority: true, lastMessageAt: true, unreadForStaff: true,
        customer: { select: { id: true, name: true, email: true } },
        guestName: true, guestEmail: true,
        assignedTo: { select: { name: true } },
        order: { select: { id: true, orderNumber: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderRole: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where }),
    prisma.conversation.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
  ]);

  const countFor = (value: string) => counts.find((row) => row.status === value)?._count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZES.dashboard));

  return (
    <>
      <PageHeader title="Support messages" description="Customer conversations, with internal notes only staff can see." />

      <div className="toolbar">
        <Link href="/dashboard/messages" className={status === "" ? "chip chip-active" : "chip"}>All</Link>
        {[["OPEN", "Open"], ["PENDING", "Awaiting customer"], ["RESOLVED", "Resolved"], ["CLOSED", "Closed"]].map(([value, label]) => (
          <Link
            key={value}
            href={`/dashboard/messages?status=${value}`}
            className={status === value ? "chip chip-active" : "chip"}
          >
            {label} ({countFor(value)})
          </Link>
        ))}
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="No conversations" description="Customer messages will appear here." />
      ) : (
        <>
          <div className="stack">
            {conversations.map((conversation) => (
              <Link key={conversation.id} href={`/dashboard/messages/${conversation.id}`} className="card-hover p-4">
                <div className="row-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {conversation.subject}
                      {conversation.unreadForStaff ? <span className="badge-red ml-2">New</span> : null}
                    </p>
                    <p className="muted-xs">
                      {conversation.customer?.name ?? conversation.guestName ?? "Guest"}
                      {conversation.order ? ` · order ${conversation.order.orderNumber}` : ""}
                      {conversation.assignedTo ? ` · assigned to ${conversation.assignedTo.name}` : " · unassigned"}
                      {` · ${conversation._count.messages} message(s)`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={conversation.status} />
                    <span className="muted-xs">{relativeTime(conversation.lastMessageAt)}</span>
                  </div>
                </div>
                {conversation.messages[0] ? (
                  <p className="mt-2 text-sm text-brand-600">
                    <span className="font-medium">{conversation.messages[0].senderRole === "STAFF" ? "You: " : "Customer: "}</span>
                    {truncate(conversation.messages[0].body, 160)}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) => `/dashboard/messages${buildQuery({ status, page: next > 1 ? next : undefined })}`}
          />
        </>
      )}
    </>
  );
}
