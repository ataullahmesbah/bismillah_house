import Link from "next/link";

import { EmptyState, PageHeader, Pagination, StatusPill } from "@/components/ui";
import { StatusAction } from "@/components/dashboard/status-action";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermissionPage } from "@/lib/auth/guards";
import { requiresStatusNote, userHasPermission } from "@/lib/auth/rbac";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { buildQuery, formatDate, maskEmail, maskPhone, parsePositiveInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermissionPage(PERMISSIONS.CUSTOMER_VIEW);
  // Moderators must say why they are suspending someone; owners need not.
  const needsReason = requiresStatusNote(user);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const status = single("status") ?? "";
  const page = parsePositiveInt(single("page"), 1, 2000);

  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    deletedAt: null,
    ...(status ? { status: status as "ACTIVE" | "SUSPENDED" | "BLOCKED" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [customers, total, canUpdate, canContact] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZES.dashboard,
      take: PAGE_SIZES.dashboard,
      select: {
        id: true, name: true, email: true, phone: true, status: true, createdAt: true, lastLoginAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
    userHasPermission(user, PERMISSIONS.CUSTOMER_UPDATE),
    userHasPermission(user, PERMISSIONS.ORDER_VIEW_CONTACT),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZES.dashboard));

  return (
    <>
      <PageHeader title="Customers" description={`${total} registered customer${total === 1 ? "" : "s"}.`} />

      <form className="filter-bar" method="get">
        <div className="field min-w-52 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Name, email or phone" />
        </div>
        <div className="field">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={status}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
        <Link href="/dashboard/customers" className="btn-ghost">Reset</Link>
      </form>

      {customers.length === 0 ? (
        <EmptyState title="No customers found" description="Adjust the filters or wait for your first sign-up." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Customer</th><th>Contact</th><th className="text-right">Orders</th><th>Status</th><th>Joined</th><th /></tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link href={`/dashboard/customers/${customer.id}`} className="font-semibold hover:underline">
                        {customer.name}
                      </Link>
                      <p className="muted-xs">
                        {customer.lastLoginAt ? `Last seen ${formatDate(customer.lastLoginAt)}` : "Never signed in"}
                      </p>
                    </td>
                    <td className="text-xs">
                      {canContact ? customer.email : maskEmail(customer.email)}
                      <br />
                      {customer.phone ? (canContact ? customer.phone : maskPhone(customer.phone)) : "—"}
                    </td>
                    <td className="td-num">{customer._count.orders}</td>
                    <td><StatusPill status={customer.status} /></td>
                    <td className="text-xs">{formatDate(customer.createdAt)}</td>
                    <td className="td-actions">
                      <div className="inline-flex gap-1.5">
                        <Link href={`/dashboard/customers/${customer.id}`} className="btn-secondary btn-xs">View</Link>
                        {canUpdate ? (
                          customer.status === "ACTIVE" ? (
                            <StatusAction
                              userId={customer.id}
                              userName={customer.name}
                              nextStatus="SUSPENDED"
                              label="Suspend"
                              requireReason={needsReason}
                            />
                          ) : (
                            <StatusAction
                              userId={customer.id}
                              userName={customer.name}
                              nextStatus="ACTIVE"
                              label="Reactivate"
                              className="btn-success btn-xs"
                            />
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) => `/dashboard/customers${buildQuery({ q, status, page: next > 1 ? next : undefined })}`}
          />
        </>
      )}
    </>
  );
}
