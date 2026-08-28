import Link from "next/link";

import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SEVERITY_CLASS: Record<string, string> = {
  INFO: "badge-gray",
  NOTICE: "badge-blue",
  WARNING: "badge-amber",
  CRITICAL: "badge-red",
};

export default async function AuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.AUDIT_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const severity = single("severity") ?? "";
  const entityType = single("entity") ?? "";
  const page = parsePositiveInt(single("page"), 1, 5000);

  const where: Prisma.AuditLogWhereInput = {
    ...(severity ? { severity: severity as "INFO" | "NOTICE" | "WARNING" | "CRITICAL" } : {}),
    ...(entityType ? { entityType } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { actorName: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q } },
          ],
        }
      : {}),
  };

  const [logs, total, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZES.dashboard,
      take: PAGE_SIZES.dashboard,
      select: {
        id: true, action: true, summary: true, entityType: true, entityId: true,
        actorName: true, actorRole: true, actorId: true, ipAddress: true,
        severity: true, createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      where: { entityType: { not: null } },
      select: { entityType: true },
      take: 40,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZES.dashboard));

  return (
    <>
      <PageHeader
        title="Audit & security log"
        description="Every privileged action, with who did it and when. Passwords, tokens and payment secrets are never recorded."
      />

      <form className="filter-bar" method="get">
        <div className="field min-w-52 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Action, summary, actor or entity id" />
        </div>
        <div className="field">
          <label className="label" htmlFor="severity">Severity</label>
          <select id="severity" name="severity" className="select" defaultValue={severity}>
            <option value="">All</option>
            <option value="INFO">Info</option>
            <option value="NOTICE">Notice</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="entity">Entity</label>
          <select id="entity" name="entity" className="select" defaultValue={entityType}>
            <option value="">All</option>
            {entityTypes.map((row) => (
              <option key={row.entityType} value={row.entityType ?? ""}>{row.entityType}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
        <Link href="/dashboard/audit-logs" className="btn-ghost">Reset</Link>
      </form>

      {logs.length === 0 ? (
        <EmptyState title="No audit entries" description="Privileged actions will be recorded here as they happen." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Severity</th><th>IP</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</td>
                    <td className="text-xs">
                      {log.actorId ? (
                        <Link href={`/dashboard/staff/${log.actorId}`} className="font-medium hover:underline">
                          {log.actorName ?? "Unknown"}
                        </Link>
                      ) : (
                        <span className="font-medium">{log.actorName ?? "System"}</span>
                      )}
                      {log.actorRole ? <span className="muted-xs block">{log.actorRole}</span> : null}
                    </td>
                    <td>
                      <p className="mono text-xs font-semibold">{log.action}</p>
                      {log.summary ? <p className="muted-xs">{log.summary}</p> : null}
                    </td>
                    <td className="text-xs">
                      {log.entityType ?? "—"}
                      {log.entityId ? <span className="mono block text-brand-400">{log.entityId.slice(0, 12)}…</span> : null}
                    </td>
                    <td><span className={SEVERITY_CLASS[log.severity] ?? "badge-gray"}>{log.severity}</span></td>
                    <td className="mono text-xs">{log.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) =>
              `/dashboard/audit-logs${buildQuery({ q, severity, entity: entityType, page: next > 1 ? next : undefined })}`
            }
          />
        </>
      )}
    </>
  );
}
