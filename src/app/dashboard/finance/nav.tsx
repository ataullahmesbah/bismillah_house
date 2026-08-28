import Link from "next/link";

import { cn } from "@/lib/utils";

export const FINANCE_TABS = [
  { href: "/dashboard/finance", label: "Overview" },
  { href: "/dashboard/finance/transactions", label: "Transactions" },
  { href: "/dashboard/finance/expenses", label: "Expenses" },
  { href: "/dashboard/finance/profit-loss", label: "Profit & loss" },
  { href: "/dashboard/finance/cash-flow", label: "Cash flow" },
  { href: "/dashboard/finance/accounts", label: "Accounts" },
  { href: "/dashboard/finance/categories", label: "Categories" },
] as const;

export function FinanceTabs({ active }: { active: string }) {
  return (
    <nav className="tabs mb-4" aria-label="Finance sections">
      {FINANCE_TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={cn("tab", tab.href === active && "tab-active")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The date-range picker every finance screen shares.
 *
 * A plain GET form, so a range survives a reload and can be bookmarked or sent
 * to an accountant as a link.
 */
export function RangePicker({ action, from, to }: { action: string; from: string; to: string }) {
  return (
    <form method="get" action={action} className="card mb-4">
      <div className="card-body flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="range-from">From</label>
          <input id="range-from" name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="range-to">To</label>
          <input id="range-to" name="to" type="date" defaultValue={to} className="input" />
        </div>
        <button type="submit" className="btn-primary">Apply</button>
      </div>
    </form>
  );
}
