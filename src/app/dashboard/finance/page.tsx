import Link from "next/link";

import { PageHeader, StatCard } from "@/components/ui";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getAccountBalances, getCategoryTotals, getFinanceSummary } from "@/lib/services/finance";
import { parseRange } from "@/lib/services/reports";

import { FinanceTabs, RangePicker } from "./nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinanceOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.FINANCE_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const range = parseRange(single("from"), single("to"), 30);

  const [summary, accounts, expenses, income, recent] = await Promise.all([
    getFinanceSummary(range),
    getAccountBalances(),
    getCategoryTotals(range, "EXPENSE"),
    getCategoryTotals(range, "INCOME"),
    prisma.financeTransaction.findMany({
      where: { voidedAt: null },
      orderBy: { occurredAt: "desc" },
      take: 8,
      select: {
        id: true, kind: true, amount: true, description: true, occurredAt: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const cashOnHand = accounts.reduce((total, account) => total + account.balance, 0);

  return (
    <>
      <PageHeader
        title="Accounts &amp; finance"
        description={`Money in and out between ${formatDate(range.from)} and ${formatDate(range.to)}.`}
      />
      <FinanceTabs active="/dashboard/finance" />
      <RangePicker
        action="/dashboard/finance"
        from={range.from.toISOString().slice(0, 10)}
        to={range.to.toISOString().slice(0, 10)}
      />

      <div className="grid-stats mb-4">
        <StatCard label="Income" value={formatMoney(summary.income)} />
        <StatCard label="Expenses" value={formatMoney(summary.expense)} />
        <StatCard
          label="Net profit"
          value={formatMoney(summary.netProfit)}
          delta={
            summary.income > 0
              ? { value: `${Math.round((summary.netProfit / summary.income) * 100)}% margin`, positive: summary.netProfit >= 0 }
              : undefined
          }
        />
        <StatCard label="Gross profit" value={formatMoney(summary.grossProfit)} hint="Sales less product and courier cost" />
        <StatCard label="Cash across accounts" value={formatMoney(cashOnHand)} href="/dashboard/finance/accounts" />
        <StatCard
          label="Courier owes us"
          value={formatMoney(summary.courierReceivable)}
          href="/dashboard/courier/settlements"
        />
        <StatCard label="COD not yet collected" value={formatMoney(summary.pendingCod)} />
        <StatCard label="Product cost" value={formatMoney(summary.productCost)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Where the money went</h2>
            <Link href="/dashboard/finance/expenses" className="btn-ghost btn-xs">All expenses</Link>
          </div>
          <div className="card-body">
            {expenses.length === 0 ? (
              <p className="muted">No expenses recorded in this period.</p>
            ) : (
              <ul className="space-y-2">
                {expenses.slice(0, 8).map((category) => {
                  const share = summary.expense > 0 ? (category.total / summary.expense) * 100 : 0;
                  return (
                    <li key={category.id ?? category.name}>
                      <div className="row-between text-sm">
                        <span className="clamp-1">{category.name}</span>
                        <span className="font-semibold tabular-nums">{formatMoney(category.total)}</span>
                      </div>
                      <div className="meter mt-1" role="presentation">
                        <span className="meter-fill" style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Where it came from</h2></div>
          <div className="card-body">
            {income.length === 0 ? (
              <p className="muted">No income recorded in this period.</p>
            ) : (
              <ul className="space-y-2">
                {income.slice(0, 8).map((category) => {
                  const share = summary.income > 0 ? (category.total / summary.income) * 100 : 0;
                  return (
                    <li key={category.id ?? category.name}>
                      <div className="row-between text-sm">
                        <span className="clamp-1">{category.name}</span>
                        <span className="font-semibold tabular-nums">{formatMoney(category.total)}</span>
                      </div>
                      <div className="meter mt-1" role="presentation">
                        <span className="meter-fill meter-fill-positive" style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="card mt-4">
        <div className="card-header">
          <h2 className="card-title">Latest entries</h2>
          <Link href="/dashboard/finance/transactions" className="btn-ghost btn-xs">All transactions</Link>
        </div>
        <div className="table-wrap border-0">
          <table className="table table-compact">
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={4} className="muted py-6 text-center">Nothing recorded yet.</td></tr>
              ) : (
                recent.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-xs whitespace-nowrap">{formatDate(entry.occurredAt)}</td>
                    <td className="clamp-1">{entry.description}</td>
                    <td className="text-xs">{entry.category?.name ?? "—"}</td>
                    <td
                      className={`td-num ${
                        entry.kind === "INCOME"
                          ? "text-success-700"
                          : entry.kind === "EXPENSE"
                            ? "text-danger-600"
                            : "text-brand-600"
                      }`}
                    >
                      {entry.kind === "INCOME" ? "+" : entry.kind === "EXPENSE" ? "−" : "⇄ "}
                      {formatMoney(entry.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
