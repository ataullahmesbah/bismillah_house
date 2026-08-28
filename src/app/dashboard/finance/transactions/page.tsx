import Link from "next/link";

import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { TransactionForm } from "@/components/dashboard/transaction-form";
import { VoidTransaction } from "@/components/dashboard/void-transaction";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDate, parsePositiveInt } from "@/lib/utils";

import { FinanceTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermissionPage(PERMISSIONS.FINANCE_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const kindParam = single("kind") ?? "";
  const kind =
    kindParam === "INCOME" || kindParam === "EXPENSE" || kindParam === "TRANSFER" ? kindParam : "";
  const showVoided = single("voided") === "1";
  const editId = single("edit");
  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const where: Prisma.FinanceTransactionWhereInput = {
    ...(showVoided ? { voidedAt: { not: null } } : { voidedAt: null }),
    ...(kind ? { kind } : {}),
    ...(q
      ? {
          OR: [
            { description: { contains: q, mode: "insensitive" } },
            { reference: { contains: q, mode: "insensitive" } },
            { vendorName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [transactions, total, categories, accounts, employees, editing, canManage, canVoid] = await Promise.all([
    prisma.financeTransaction.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, reference: true, kind: true, amount: true, description: true, occurredAt: true,
        paymentMethod: true, vendorName: true, isAutomatic: true, voidedAt: true, voidReason: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
        order: { select: { id: true, orderNumber: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.financeTransaction.count({ where }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ kind: "asc" }, { position: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.financeAccount.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, role: { in: ["SUPER_ADMIN", "ADMIN", "MODERATOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    editId
      ? prisma.financeTransaction.findUnique({
          where: { id: editId },
          select: {
            id: true, kind: true, categoryId: true, accountId: true, amount: true, description: true,
            occurredAt: true, paymentMethod: true, vendorName: true, employeeId: true,
            attachmentUrl: true, note: true, voidedAt: true,
          },
        })
      : Promise.resolve(null),
    userHasPermission(user, PERMISSIONS.FINANCE_MANAGE),
    userHasPermission(user, PERMISSIONS.FINANCE_VOID),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every entry in the books. Nothing is deleted — a wrong entry is voided, with a reason."
      />
      <FinanceTabs active="/dashboard/finance/transactions" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {canManage ? (
          <section className="card self-start">
            <div className="card-header">
              <h2 className="card-title">{editing ? "Edit entry" : "New entry"}</h2>
              {editing ? (
                <Link href="/dashboard/finance/transactions" className="btn-link text-xs">Cancel</Link>
              ) : null}
            </div>
            {editing?.voidedAt ? (
              <div className="card-body">
                <p className="muted">
                  This entry is voided and cannot be edited. Post a correcting entry instead.
                </p>
              </div>
            ) : (
              <TransactionForm
                categories={categories}
                accounts={accounts}
                employees={employees.map((employee) => ({ id: employee.id, name: employee.name ?? "Unnamed" }))}
                today={today}
                draft={
                  editing
                    ? {
                        id: editing.id,
                        kind: editing.kind === "INCOME" ? "INCOME" : "EXPENSE",
                        categoryId: editing.categoryId,
                        accountId: editing.accountId,
                        amount: editing.amount,
                        description: editing.description,
                        occurredAt: editing.occurredAt.toISOString().slice(0, 10),
                        paymentMethod: editing.paymentMethod,
                        vendorName: editing.vendorName,
                        employeeId: editing.employeeId,
                        attachmentUrl: editing.attachmentUrl,
                        note: editing.note,
                      }
                    : null
                }
              />
            )}
          </section>
        ) : null}

        <section>
          <form method="get" className="card mb-4">
            <div className="card-body flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <label className="label" htmlFor="txn-q">Search</label>
                <input id="txn-q" name="q" defaultValue={q} className="input" placeholder="Description, vendor or reference" />
              </div>
              <div className="min-w-36">
                <label className="label" htmlFor="txn-kind">Direction</label>
                <select id="txn-kind" name="kind" defaultValue={kind} className="select">
                  <option value="">All</option>
                  <option value="INCOME">Money in</option>
                  <option value="EXPENSE">Money out</option>
                  <option value="TRANSFER">Transfers</option>
                </select>
              </div>
              <button type="submit" className="btn-primary">Filter</button>
              <Link
                href="/api/dashboard/finance/export?scope=transactions"
                className="btn-secondary"
                prefetch={false}
              >
                Export CSV
              </Link>
            </div>
          </form>

          <div className="tabs mb-4">
            <Link href="/dashboard/finance/transactions" className={showVoided ? "tab" : "tab tab-active"}>Live</Link>
            <Link href="/dashboard/finance/transactions?voided=1" className={showVoided ? "tab tab-active" : "tab"}>
              Voided
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="card"><div className="card-body">
              <EmptyState
                title={showVoided ? "Nothing voided" : "No entries yet"}
                description={
                  showVoided
                    ? "Voided entries stay here permanently, with the reason they were voided."
                    : "Record an expense or income on the left, or let orders post revenue automatically."
                }
              />
            </div></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Description</th><th>Category</th>
                    <th className="text-right">Amount</th><th>Source</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((entry) => (
                    <tr key={entry.id} className={entry.voidedAt ? "opacity-60" : undefined}>
                      <td className="text-xs whitespace-nowrap">{formatDate(entry.occurredAt)}</td>
                      <td>
                        <span className="clamp-1 font-medium">{entry.description}</span>
                        <span className="muted-xs block">
                          {entry.reference}
                          {entry.vendorName ? ` · ${entry.vendorName}` : ""}
                          {entry.account ? ` · ${entry.account.name}` : ""}
                        </span>
                        {entry.order ? (
                          <Link href={`/dashboard/orders/${entry.order.id}`} className="muted-xs hover:underline">
                            {entry.order.orderNumber}
                          </Link>
                        ) : null}
                        {entry.voidReason ? (
                          <span className="muted-xs block text-danger-600">Voided: {entry.voidReason}</span>
                        ) : null}
                      </td>
                      <td className="text-xs">{entry.category?.name ?? "—"}</td>
                      <td
                        className={`td-num ${
                          entry.kind === "INCOME"
                            ? "text-success-600"
                            : entry.kind === "EXPENSE"
                              ? "text-danger-600"
                              : "text-brand-600"
                        }`}
                      >
                        {entry.kind === "INCOME" ? "+" : entry.kind === "EXPENSE" ? "−" : "⇄ "}
                        {formatMoney(entry.amount)}
                      </td>
                      <td className="text-xs">
                        {entry.isAutomatic ? (
                          <span className="badge-outline">Automatic</span>
                        ) : (
                          entry.createdBy?.name ?? "—"
                        )}
                      </td>
                      <td className="text-right">
                        {entry.voidedAt ? (
                          <span className="badge-red">Voided</span>
                        ) : (
                          <div className="row-actions">
                            {canManage ? (
                              <Link
                                href={`/dashboard/finance/transactions?edit=${entry.id}`}
                                className="btn-secondary btn-xs"
                              >
                                Edit
                              </Link>
                            ) : null}
                            {canVoid ? <VoidTransaction id={entry.id} description={entry.description} /> : null}
                          </div>
                        )}
                      </td>
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
              `/dashboard/finance/transactions${buildQuery({
                q,
                kind,
                voided: showVoided ? "1" : undefined,
                page: next > 1 ? next : undefined,
              })}`
            }
          />
        </section>
      </div>
    </>
  );
}
