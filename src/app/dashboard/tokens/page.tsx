import Link from "next/link";

import { EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { TOKEN_CATEGORY_LABELS, TOKEN_PRIORITY_LABELS } from "@/lib/services/tokens";
import { buildQuery, relativeTime } from "@/lib/utils";
import type { TokenStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Views a staff member actually works from, rather than a single flat list. */
const VIEWS = [
  { key: "mine", label: "Assigned to me" },
  { key: "open", label: "Open" },
  { key: "raised", label: "Raised by me" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All tokens" },
] as const;

export default async function TokensPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermissionPage(PERMISSIONS.TOKEN_VIEW);
  const params = await searchParams;
  const raw = params.view;
  const viewKey = (Array.isArray(raw) ? raw[0] : raw) ?? "mine";
  const view = VIEWS.find((entry) => entry.key === viewKey) ?? VIEWS[0];

  const canCreate = await userHasPermission(user, PERMISSIONS.TOKEN_CREATE);

  const whereFor = (key: string) => {
    switch (key) {
      case "mine":
        return { assignees: { some: { userId: user.id } }, status: { in: ["OPEN", "IN_PROGRESS"] as TokenStatus[] } };
      case "open":
        return { status: { in: ["OPEN", "IN_PROGRESS"] as TokenStatus[] } };
      case "raised":
        return { createdById: user.id };
      case "resolved":
        return { status: { in: ["RESOLVED", "CLOSED"] as TokenStatus[] } };
      default:
        return {};
    }
  };

  const [tokens, counts] = await Promise.all([
    prisma.token.findMany({
      where: whereFor(view.key),
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true, reference: true, subject: true, category: true, priority: true,
        status: true, createdAt: true,
        createdBy: { select: { name: true } },
        assignees: { select: { doneAt: true, user: { select: { id: true, name: true } } } },
      },
    }),
    Promise.all(VIEWS.map((entry) => prisma.token.count({ where: whereFor(entry.key) }))),
  ]);

  return (
    <>
      <PageHeader
        title="Tokens"
        description="Internal tickets between staff — never visible to customers."
        action={canCreate ? <Link href="/dashboard/tokens/new" className="btn-primary btn-sm">Raise a token</Link> : undefined}
      />

      <nav className="tabs mb-4" aria-label="Token views">
        {VIEWS.map((entry, index) => (
          <Link
            key={entry.key}
            href={`/dashboard/tokens${buildQuery({ view: entry.key })}`}
            className={entry.key === view.key ? "tab tab-active" : "tab"}
            aria-current={entry.key === view.key ? "page" : undefined}
          >
            {entry.label}
            <span className={counts[index] > 0 ? "tab-count" : "tab-count tab-count-empty"}>{counts[index]}</span>
          </Link>
        ))}
      </nav>

      {tokens.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <EmptyState
              title="Nothing here"
              description="Tokens raised for this view will appear here."
            />
          </div>
        </div>
      ) : (
        <div className="stack">
          {tokens.map((token) => (
            <Link key={token.id} href={`/dashboard/tokens/${token.id}`} className="card block transition hover:border-brand-400">
              <div className="card-body">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-xs font-bold text-brand-500">{token.reference}</span>
                  <StatusPill status={token.status} />
                  <span className="badge-outline">{TOKEN_CATEGORY_LABELS[token.category]}</span>
                  {token.priority === "URGENT" || token.priority === "HIGH" ? (
                    <span className="badge-danger">{TOKEN_PRIORITY_LABELS[token.priority]}</span>
                  ) : null}
                  <span className="muted-xs ml-auto">{relativeTime(token.createdAt)}</span>
                </div>

                <p className="mt-1.5 font-semibold text-brand-950">{token.subject}</p>

                <p className="muted-xs mt-1">
                  Raised by {token.createdBy.name} · Assigned to{" "}
                  {token.assignees.map((assignee) => assignee.user.name).join(", ") || "nobody"}
                  {token.assignees.length > 0
                    ? ` · ${token.assignees.filter((a) => a.doneAt).length}/${token.assignees.length} done`
                    : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
