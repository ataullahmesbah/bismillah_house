import Link from "next/link";

import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { getCategoryTotals } from "@/lib/services/finance";
import { parseRange } from "@/lib/services/reports";

import { FinanceTabs, RangePicker } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Spending, broken down the way the shop actually thinks about it.
 *
 * Staff lunches, salary, bonuses, gifts, tours, packaging, ads — these are the
 * lines a Bangladeshi retail business argues about at month end, so they get
 * their own view rather than being buried in the transaction list.
 */
export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.FINANCE_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const range = parseRange(single("from"), single("to"), 30);
  const categoryId = single("category") ?? "";

  const [totals, entries, staffSpend] = await Promise.all([
    getCategoryTotals(range, "EXPENSE"),
    prisma.financeTransaction.findMany({
      where: {
        kind: "EXPENSE",
        voidedAt: null,
        occurredAt: { gte: range.from, lte: range.to },
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
      select: {
        id: true, amount: true, description: true, occurredAt: true, vendorName: true,
        paymentMethod: true, attachmentUrl: true, isAutomatic: true,
        category: { select: { id: true, name: true } },
        employee: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.financeTransaction.groupBy({
      by: ["employeeId"],
      where: {
        kind: "EXPENSE",
        voidedAt: null,
        employeeId: { not: null },
        occurredAt: { gte: range.from, lte: range.to },
      },
      _sum: { amount: true },
    }),
  ]);

  const total = totals.reduce((sum, category) => sum + category.total, 0);
  const biggest = totals[0];
  const staffTotal = staffSpend.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Expenses"
        description={`What the business spent between ${formatDate(range.from)} and ${formatDate(range.to)}.`}
      />
      <FinanceTabs active="/dashboard/finance/expenses" />
      <RangePicker
        action="/dashboard/finance/expenses"
        from={range.from.toISOString().slice(0, 10)}
        to={range.to.toISOString().slice(0, 10)}
      />

      <div className="stat-grid mb-4">
        <StatCard label="Total spent" value={formatMoney(total)} />
        <StatCard label="Categories used" value={totals.length} />
        <StatCard label="Biggest line" value={biggest ? biggest.name : "—"} hint={biggest ? formatMoney(biggest.total) : undefined} />
        <StatCard label="Spent on staff" value={formatMoney(staffTotal)} hint="Salary, bonus, food, travel" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section className="card self-start">
          <div className="card-header"><h2 className="card-title">By category</h2></div>
          <div className="card-body">
            {totals.length === 0 ? (
              <p className="muted">Nothing spent in this period.</p>
            ) : (
              <ul className="space-y-2">
                <li>
                  <Link
                    href={`/dashboard/finance/expenses?from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`}
                    className={categoryId ? "row-between text-sm hover:underline" : "row-between text-sm font-bold"}
                  >
                    <span>All categories</span>
                    <span className="tabular-nums">{formatMoney(total)}</span>
                  </Link>
                </li>
                {totals.map((category) => {
                  const share = total > 0 ? (category.total / total) * 100 : 0;
                  return (
                    <li key={category.id ?? category.name}>
                      <Link
                        href={`/dashboard/finance/expenses?category=${category.id ?? ""}&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`}
                        className={
                          categoryId === category.id
                            ? "row-between text-sm font-bold"
                            : "row-between text-sm hover:underline"
                        }
                      >
                        <span className="clamp-1">{category.name}</span>
                        <span className="tabular-nums">{formatMoney(category.total)}</span>
                      </Link>
                      <div className="meter mt-1" role="presentation">
                        <span className="meter-fill" style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                      <p className="muted-xs">{category.count} entr{category.count === 1 ? "y" : "ies"} · {share.toFixed(0)}%</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Entries</h2>
            <Link href="/dashboard/finance/transactions" className="btn-secondary btn-xs">Record an expense</Link>
          </div>
          {entries.length === 0 ? (
            <div className="card-body">
              <EmptyState
                title="No expenses in this period"
                description="Widen the date range, or record what the business has spent."
              />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>What</th><th>Category</th><th>Paid to</th><th className="text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-xs whitespace-nowrap">{formatDate(entry.occurredAt)}</td>
                      <td>
                        <span className="clamp-1 font-medium">{entry.description}</span>
                        <span className="muted-xs block">
                          {entry.paymentMethod ?? "—"}
                          {entry.isAutomatic ? " · automatic" : entry.createdBy?.name ? ` · ${entry.createdBy.name}` : ""}
                        </span>
                        {entry.attachmentUrl ? (
                          <a
                            href={entry.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="muted-xs hover:underline"
                          >
                            Receipt
                          </a>
                        ) : null}
                      </td>
                      <td className="text-xs">{entry.category?.name ?? "—"}</td>
                      <td className="text-xs">{entry.employee?.name ?? entry.vendorName ?? "—"}</td>
                      <td className="td-num text-danger-600">{formatMoney(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
