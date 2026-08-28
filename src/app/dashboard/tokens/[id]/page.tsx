import { notFound } from "next/navigation";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { AssigneePicker } from "@/components/dashboard/assignee-picker";
import { Field, PageHeader, StatusPill } from "@/components/ui";
import {
  assignTokenAction, commentOnTokenAction, markTokenDoneAction, updateTokenStatusAction,
} from "@/app/actions/dashboard/tokens";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/constants";
import {
  assignableStaff, TOKEN_CATEGORY_LABELS, TOKEN_PRIORITY_LABELS,
  TOKEN_STATUS_LABELS, TOKEN_STATUS_TRANSITIONS,
} from "@/lib/services/tokens";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermissionPage(PERMISSIONS.TOKEN_VIEW);
  const { id } = await params;

  const token = await prisma.token.findUnique({
    where: { id },
    select: {
      id: true, reference: true, subject: true, description: true, category: true,
      priority: true, status: true, relatedType: true, relatedId: true, createdAt: true,
      createdBy: { select: { name: true, role: true } },
      assignees: {
        orderBy: { assignedAt: "asc" },
        select: { doneAt: true, user: { select: { id: true, name: true, role: true } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, createdAt: true, author: { select: { name: true, role: true } } },
      },
    },
  });

  if (!token) notFound();

  const [canAssign, canClose, staff] = await Promise.all([
    userHasPermission(user, PERMISSIONS.TOKEN_ASSIGN),
    userHasPermission(user, PERMISSIONS.TOKEN_CLOSE),
    assignableStaff(),
  ]);

  const myAssignment = token.assignees.find((assignee) => assignee.user.id === user.id);

  return (
    <>
      <PageHeader
        title={token.subject}
        description={`${token.reference} · raised by ${token.createdBy.name} ${relativeTime(token.createdAt)}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="stack">
          <section className="card">
            <div className="card-header">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={token.status} />
                <span className="badge-outline">{TOKEN_CATEGORY_LABELS[token.category]}</span>
                <span className={token.priority === "URGENT" || token.priority === "HIGH" ? "badge-danger" : "badge-gray"}>
                  {TOKEN_PRIORITY_LABELS[token.priority]}
                </span>
              </div>
            </div>
            <div className="card-body">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{token.description}</p>
              {token.relatedType || token.relatedId ? (
                <p className="muted-xs mt-3">
                  Related: {token.relatedType ?? "—"} {token.relatedId ? <span className="mono">{token.relatedId}</span> : null}
                </p>
              ) : null}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Replies ({token.comments.length})</h2></div>
            {token.comments.length === 0 ? (
              <div className="card-body"><p className="muted">No replies yet.</p></div>
            ) : (
              <ul className="divide-y divide-line">
                {token.comments.map((comment) => (
                  <li key={comment.id} className="p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold">{comment.author.name}</span>
                      <span className="badge-gray">{ROLE_LABELS[comment.author.role]}</span>
                      <time className="muted-xs ml-auto" dateTime={comment.createdAt.toISOString()}>
                        {formatDateTime(comment.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <ActionForm action={commentOnTokenAction} className="border-t border-line p-4" successRedirect={false}>
              <input type="hidden" name="tokenId" value={token.id} />
              <Field label="Add a reply" htmlFor="body" errorFor="body">
                <textarea id="body" name="body" className="textarea" rows={3} maxLength={2000} required />
              </Field>
              <div className="mt-3">
                <SubmitButton>Reply</SubmitButton>
              </div>
            </ActionForm>
          </section>
        </div>

        <aside className="stack lg:sticky lg:top-20 lg:self-start">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Assigned to</h2></div>
            <div className="card-body stack">
              <ul className="space-y-2">
                {token.assignees.map((assignee) => (
                  <li key={assignee.user.id} className="flex items-center gap-2 text-sm">
                    <span className={assignee.doneAt ? "text-success-600" : "text-brand-400"} aria-hidden="true">
                      {assignee.doneAt ? "✓" : "○"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {assignee.user.name}
                      {assignee.user.id === user.id ? " (you)" : ""}
                    </span>
                    <span className="badge-gray">{ROLE_LABELS[assignee.user.role]}</span>
                  </li>
                ))}
              </ul>

              {myAssignment ? (
                <QuickActionForm
                  action={markTokenDoneAction}
                  values={{ tokenId: token.id }}
                  label={myAssignment.doneAt ? "Reopen my part" : "Mark my part done"}
                  className="btn-secondary btn-sm btn-block"
                />
              ) : null}
            </div>
          </section>

          {canClose ? (
            <ActionForm action={updateTokenStatusAction} className="card" successRedirect={false}>
              <div className="card-header"><h2 className="card-title">Status</h2></div>
              <div className="card-body stack">
                <input type="hidden" name="tokenId" value={token.id} />
                <Field label="Move to" htmlFor="status" errorFor="status">
                  <select id="status" name="status" className="select" defaultValue={TOKEN_STATUS_TRANSITIONS[token.status][0]}>
                    {TOKEN_STATUS_TRANSITIONS[token.status].map((next) => (
                      <option key={next} value={next}>{TOKEN_STATUS_LABELS[next]}</option>
                    ))}
                  </select>
                </Field>
                <SubmitButton className="btn-primary btn-sm btn-block">Update status</SubmitButton>
              </div>
            </ActionForm>
          ) : null}

          {canAssign ? (
            <ActionForm action={assignTokenAction} className="card" successRedirect={false}>
              <div className="card-header"><h2 className="card-title">Reassign</h2></div>
              <div className="card-body stack">
                <input type="hidden" name="tokenId" value={token.id} />
                <AssigneePicker staff={staff} selectedIds={token.assignees.map((a) => a.user.id)} />
                <SubmitButton className="btn-secondary btn-sm btn-block">Save assignees</SubmitButton>
              </div>
            </ActionForm>
          ) : null}
        </aside>
      </div>
    </>
  );
}
