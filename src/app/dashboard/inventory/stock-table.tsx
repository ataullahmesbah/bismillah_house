import Link from "next/link";

import { EmptyState, Pagination } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDate } from "@/lib/utils";
import type { StockRow } from "@/lib/services/inventory";

/**
 * The stock grid, shared by Products, Variants, Low stock and Out of stock.
 *
 * Four tabs showing the same columns with different filters is one component,
 * not four near-identical tables that drift apart the first time a column is
 * added.
 */
export function StockTable({
  rows,
  total,
  page,
  perPage,
  basePath,
  query,
  showCost,
  emptyTitle,
  emptyDescription,
}: {
  rows: StockRow[];
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  query: Record<string, string | number | undefined>;
  /** Cost prices are hidden from staff who may not see what things cost us. */
  showCost: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="text-right">On hand</th>
              <th className="text-right">Reserved</th>
              <th className="text-right">Available</th>
              <th className="text-right">Incoming</th>
              <th className="text-right">Alert / reorder</th>
              {showCost ? <th className="text-right">Stock value</th> : null}
              <th>Last restocked</th>
              <th className="text-right">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const stockState =
                row.available <= 0 ? "stock-out" : row.available <= row.lowStockThreshold ? "stock-low" : "stock-in";
              return (
                <tr key={row.id}>
                  <td>
                    <Link href={`/dashboard/products/${row.productId}`} className="font-semibold hover:underline">
                      {row.name}
                    </Link>
                    {row.variantName ? <span className="muted-xs block">{row.variantName}</span> : null}
                    {row.categoryName ? <span className="muted-xs block">{row.categoryName}</span> : null}
                  </td>
                  <td className="text-xs">{row.sku ?? "—"}</td>
                  <td className="td-num">{row.onHand}</td>
                  <td className="td-num">{row.reserved > 0 ? row.reserved : "—"}</td>
                  <td className="td-num"><span className={stockState}>{row.available}</span></td>
                  <td className="td-num">{row.incoming > 0 ? row.incoming : "—"}</td>
                  <td className="td-num text-xs">
                    {row.lowStockThreshold} / {row.reorderLevel}
                  </td>
                  {showCost ? (
                    <td className="td-num">{formatMoney(row.available * (row.costPrice ?? 0))}</td>
                  ) : null}
                  <td className="text-xs">{row.lastRestockedAt ? formatDate(row.lastRestockedAt) : "—"}</td>
                  <td className="text-right">
                    <Link
                      href={`/dashboard/inventory/adjustments?product=${row.productId}${
                        row.variantName ? `&variant=${row.id}` : ""
                      }`}
                      className="btn-secondary btn-xs"
                    >
                      Adjust
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(next) => `${basePath}${buildQuery({ ...query, page: next > 1 ? next : undefined })}`}
      />
    </>
  );
}

/** Search + filter bar above the grid. Plain GET so it survives a page reload. */
export function StockFilters({
  action,
  q,
  extra,
}: {
  action: string;
  q: string;
  extra?: React.ReactNode;
}) {
  return (
    <form method="get" action={action} className="card mb-4">
      <div className="card-body flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="stock-q">Search</label>
          <input id="stock-q" name="q" defaultValue={q} className="input" placeholder="Product name or SKU" />
        </div>
        {extra}
        <button type="submit" className="btn-primary">Filter</button>
      </div>
    </form>
  );
}
