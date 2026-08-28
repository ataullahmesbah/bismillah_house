import Link from "next/link";

import { PageHeader, StatCard } from "@/components/ui";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { getAccountBalances, getCashFlow } from "@/lib/services/finance";
import { parseRange } from "@/lib/services/reports";

import { FinanceTabs, RangePicker } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CashFlowPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.FINANCE_VIEW);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const range = parseRange(single("from"), single("to"), 30);
  const rangeQuery = `from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`;

  const [flow, accounts] = await Promise.all([getCashFlow(range), getAccountBalances()]);

  const totalIn = flow.reduce((sum, point) => sum + point.income, 0);
  const totalOut = flow.reduce((sum, point) => sum + point.expense, 0);
  const peak = Math.max(1, ...flow.map((point) => Math.max(point.income, point.expense)));

  // Running balance, so the table answers "did we ever dip?" rather than just
  // "what happened each day". A reduce rather than a mutated accumulator:
  // React's rules forbid reassigning a variable across a render.
  const withRunning = flow.reduce<Array<(typeof flow)[number] & { running: number }>>((rows, point) => {
    const previous = rows.at(-1)?.running ?? 0;
    rows.push({ ...point, running: previous + point.net });
    return rows;
  }, []);

  return (
    <>
      <PageHeader
        title="Cash flow"
        description={`Money in and out, day by day, ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={
          <Link href={`/api/dashboard/finance/export?scope=cash-flow&${rangeQuery}`} className="btn-secondary" prefetch={false}>
            Export CSV
          </Link>
        }
      />
      <FinanceTabs active="/dashboard/finance/cash-flow" />
      <RangePicker
        action="/dashboard/finance/cash-flow"
        from={range.from.toISOString().slice(0, 10)}
        to={range.to.toISOString().slice(0, 10)}
      />

      <div className="stat-grid mb-4">
        <StatCard label="Money in" value={formatMoney(totalIn)} />
        <StatCard label="Money out" value={formatMoney(totalOut)} />
        <StatCard
          label="Net movement"
          value={formatMoney(totalIn - totalOut)}
          delta={{ value: totalIn - totalOut >= 0 ? "positive" : "negative", positive: totalIn - totalOut >= 0 }}
        />
        <StatCard
          label="Across all accounts"
          value={formatMoney(accounts.reduce((sum, account) => sum + account.balance, 0))}
          href="/dashboard/finance/accounts"
        />
      </div>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Daily movement</h2></div>
        {withRunning.length === 0 ? (
          <div className="card-body"><p className="muted">Nothing moved in this period.</p></div>
        ) : (
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead>
                <tr><th>Date</th><th>In</th><th className="text-right">Amount in</th><th className="text-right">Amount out</th><th className="text-right">Net</th><th className="text-right">Running</th></tr>
              </thead>
              <tbody>
                {withRunning.map((point) => (
                  <tr key={point.date}>
                    <td className="text-xs whitespace-nowrap">{point.date}</td>
                    <td className="w-40">
                      {/* Two stacked bars beat a legend: in on top, out below. */}
                      <span className="meter" role="presentation">
                        <span className="meter-fill meter-fill-positive" style={{ width: `${(point.income / peak) * 100}%` }} />
                      </span>
                      <span className="meter mt-1" role="presentation">
                        <span className="meter-fill" style={{ width: `${(point.expense / peak) * 100}%` }} />
                      </span>
                    </td>
                    <td className="td-num text-success-600">{point.income > 0 ? formatMoney(point.income) : "—"}</td>
                    <td className="td-num text-danger-600">{point.expense > 0 ? formatMoney(point.expense) : "—"}</td>
                    <td className={`td-num ${point.net >= 0 ? "text-success-600" : "text-danger-600"}`}>
                      {formatMoney(point.net)}
                    </td>
                    <td className="td-num font-semibold">{formatMoney(point.running)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
