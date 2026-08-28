import { QuickActionForm } from "@/components/dashboard/action-form";
import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { updateLeadStatusAction } from "@/app/actions/dashboard/engagement";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.MESSAGE_VIEW);
  const params = await searchParams;
  const page = parsePositiveInt(typeof params.page === "string" ? params.page : undefined, 1, 1000);

  const [leads, total] = await Promise.all([
    prisma.contactLead.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZES.dashboard,
      take: PAGE_SIZES.dashboard,
    }),
    prisma.contactLead.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZES.dashboard));

  return (
    <>
      <PageHeader title="Contact leads" description="Messages submitted through the public contact form." />

      {leads.length === 0 ? (
        <EmptyState title="No contact messages" description="Submissions from /contact will land here." />
      ) : (
        <>
          <div className="stack">
            {leads.map((lead) => (
              <article key={lead.id} className="card">
                <div className="card-header">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{lead.subject}</p>
                    <p className="muted-xs">
                      {lead.name} · <a className="link" href={`mailto:${lead.email}`}>{lead.email}</a>
                      {lead.phone ? <> · <a className="link" href={`tel:${lead.phone}`}>{lead.phone}</a></> : null}
                      {` · ${formatDateTime(lead.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={lead.status === "NEW" ? "badge-red" : lead.status === "REPLIED" ? "badge-green" : "badge-gray"}>
                      {lead.status}
                    </span>
                    {lead.status !== "REPLIED" ? (
                      <QuickActionForm
                        action={updateLeadStatusAction}
                        values={{ id: lead.id, status: "REPLIED" }}
                        label="Mark replied"
                        className="btn-success btn-xs"
                      />
                    ) : null}
                    {lead.status !== "ARCHIVED" ? (
                      <QuickActionForm
                        action={updateLeadStatusAction}
                        values={{ id: lead.id, status: "ARCHIVED" }}
                        label="Archive"
                        className="btn-ghost btn-xs"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="card-body">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-700">{lead.message}</p>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) => `/dashboard/leads${buildQuery({ page: next > 1 ? next : undefined })}`}
          />
        </>
      )}
    </>
  );
}
