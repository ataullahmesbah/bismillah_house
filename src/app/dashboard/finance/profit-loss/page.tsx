import Link from "next/link";

import { PageHeader, StatCard } from "@/components/ui";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { getCategoryTotals, getFinanceSummary } from "@/lib/services/finance";
import { parseRange } from "@/lib/services/reports";

import { FinanceTabs, RangePicker } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProfitLossPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.FINANCE_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const range = parseRange(single("from"), single("to"), 30);
  const rangeQuery = `from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`;

  const [summary, income, expenses] = await Promise.all([
    getFinanceSummary(range),
    getCategoryTotals(range, "INCOME"),
    getCategoryTotals(range, "EXPENSE"),
  ]);

  const margin = summary.income > 0 ? (summary.netProfit / summary.income) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Profit &amp; loss"
        description={`${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={
          <Link href={`/api/dashboard/finance/export?scope=profit-loss&${rangeQuery}`} className="btn-secondary" prefetch={false}>
            Export CSV
          </Link>
        }
      />
      <FinanceTabs active="/dashboard/finance/profit-loss" />
      <RangePicker
        action="/dashboard/finance/profit-loss"
        from={range.from.toISOString().slice(0, 10)}
        to={range.to.toISOString().slice(0, 10)}
      />

      <div className="grid-stats mb-4">
        <StatCard label="Revenue" value={formatMoney(summary.income)} />
        <StatCard label="Costs" value={formatMoney(summary.expense)} />
        <StatCard
          label="Net profit"
          value={formatMoney(summary.netProfit)}
          delta={{ value: `${margin.toFixed(1)}%`, positive: summary.netProfit >= 0 }}
        />
        <StatCard label="Gross profit" value={formatMoney(summary.grossProfit)} />
      </div>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Statement</h2></div>
        <div className="table-wrap border-0">
          <table className="table">
            <tbody>
              <tr className="bg-surface-muted">
                <th colSpan={2} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide">Income</th>
              </tr>
              {income.length === 0 ? (
                <tr><td colSpan={2} className="muted py-4 text-center">No income recorded.</td></tr>
              ) : (
                income.map((row) => (
                  <tr key={row.id ?? row.name}>
                    <td>{row.name}</td>
                    <td className="td-num">{formatMoney(row.total)}</td>
                  </tr>
                ))
              )}
              <tr className="font-bold">
                <td>Total income</td>
                <td className="td-num text-success-700">{formatMoney(summary.income)}</td>
              </tr>

              <tr className="bg-surface-muted">
                <th colSpan={2} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide">Costs</th>
              </tr>
              {expenses.length === 0 ? (
                <tr><td colSpan={2} className="muted py-4 text-center">No costs recorded.</td></tr>
              ) : (
                expenses.map((row) => (
                  <tr key={row.id ?? row.name}>
                    <td>{row.name}</td>
                    <td className="td-num">({formatMoney(row.total)})</td>
                  </tr>
                ))
              )}
              <tr className="font-bold">
                <td>Total costs</td>
                <td className="td-num text-danger-600">({formatMoney(summary.expense)})</td>
              </tr>

              <tr className="border-t-2 border-line-strong text-base font-bold">
                <td>Net {summary.netProfit >= 0 ? "profit" : "loss"}</td>
                <td className={`td-num ${summary.netProfit >= 0 ? "text-success-700" : "text-danger-600"}`}>
                  {formatMoney(Math.abs(summary.netProfit))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="card-body border-t border-line">
          <p className="muted-xs">
            Voided entries are excluded. Revenue is recognised when an order reaches the point set in
            Settings → Finance, so a period&apos;s figures can move if an order is delivered later than it was placed.
          </p>
        </div>
      </section>

      <section className="card mt-4">
        <div className="card-header"><h2 className="card-title">Still owed to us</h2></div>
        <div className="card-body">
          <dl className="detail-list">
            <div>
              <dt>Held by couriers</dt>
              <dd>{formatMoney(summary.courierReceivable)}</dd>
            </div>
            <div>
              <dt>Cash on delivery not yet collected</dt>
              <dd>{formatMoney(summary.pendingCod)}</dd>
            </div>
            <div className="border-t border-line pt-2 font-bold">
              <dt>Total receivable</dt>
              <dd>{formatMoney(summary.courierReceivable + summary.pendingCod)}</dd>
            </div>
          </dl>
          <p className="muted-xs mt-3">
            Receivables are not counted as profit above — the money has been earned but has not arrived.
          </p>
        </div>
      </section>
    </>
  );
}
