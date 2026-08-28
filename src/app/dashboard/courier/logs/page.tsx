import Link from "next/link";

import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

import { CourierTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Every call we made to a courier, and what came back.
 *
 * "I pressed send to courier and nothing happened" is otherwise unanswerable.
 * Credentials never appear here — the request is redacted before it is stored.
 */
export default async function DispatchLogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAnyPermissionPage([PERMISSIONS.COURIER_MANAGE, PERMISSIONS.AUDIT_VIEW]);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const failedOnly = single("failed") === "1";
  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const where = failedOnly ? { success: false } : {};

  const [logs, total] = await Promise.all([
    prisma.courierDispatchLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, courierCode: true, operation: true, success: true, statusCode: true,
        errorMessage: true, createdAt: true, orderId: true,
        order: { select: { orderNumber: true } },
        actor: { select: { name: true } },
      },
    }),
    prisma.courierDispatchLog.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Dispatch log"
        description="Requests sent to couriers and their outcome. Useful when a parcel did not get created."
      />
      <CourierTabs active="/dashboard/courier/logs" />

      <div className="tabs mb-4">
        <Link href="/dashboard/courier/logs" className={failedOnly ? "tab" : "tab tab-active"}>All attempts</Link>
        <Link href="/dashboard/courier/logs?failed=1" className={failedOnly ? "tab tab-active" : "tab"}>Failures only</Link>
      </div>

      {logs.length === 0 ? (
        <div className="card"><div className="card-body">
          <EmptyState title="Nothing logged yet" description="Every courier call, successful or not, is recorded here." />
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>When</th><th>Order</th><th>Courier</th><th>Operation</th><th>Result</th><th>By</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td>
                    <Link href={`/dashboard/orders/${log.orderId}`} className="hover:underline">
                      {log.order.orderNumber}
                    </Link>
                  </td>
                  <td className="text-xs">{log.courierCode}</td>
                  <td className="text-xs">{log.operation}</td>
                  <td>
                    {log.success ? (
                      <span className="badge-green">OK{log.statusCode ? ` ${log.statusCode}` : ""}</span>
                    ) : (
                      <>
                        <span className="badge-red">Failed</span>
                        {log.errorMessage ? <span className="muted-xs block clamp-2">{log.errorMessage}</span> : null}
                      </>
                    )}
                  </td>
                  <td className="text-xs">{log.actor?.name ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / perPage))}
        buildHref={(next) =>
          `/dashboard/courier/logs${buildQuery({ failed: failedOnly ? "1" : undefined, page: next > 1 ? next : undefined })}`
        }
      />
    </>
  );
}
