"use client";

import { useMemo, useState } from "react";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { createIncomingStockAction } from "@/app/actions/dashboard/inventory";
import { formatMoney } from "@/lib/money";

export type IncomingOption = {
  id: string;
  productId: string;
  variantId: string | null;
  label: string;
  costPrice: number | null;
};

type Line = { key: string; productId: string; variantId: string; quantity: string; unitCost: string; label: string };

/**
 * Builds a supplier shipment line by line.
 *
 * Lines are posted as parallel arrays of repeated fields, which is how a plain
 * form can carry a variable-length list without any client-side submission —
 * the action zips them back together and drops anything with no quantity.
 */
export function IncomingBuilder({
  options,
  warehouses,
}: {
  options: IncomingOption[];
  warehouses: Array<{ id: string; name: string }>;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
    return pool.slice(0, 40);
  }, [options, query]);

  function addLine(option: IncomingOption) {
    setLines((current) => {
      if (current.some((line) => line.key === option.id)) return current;
      return [
        ...current,
        {
          key: option.id,
          productId: option.productId,
          variantId: option.variantId ?? "",
          quantity: "1",
          unitCost: option.costPrice ? (option.costPrice / 100).toFixed(2) : "",
          label: option.label,
        },
      ];
    });
    setQuery("");
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const totalUnits = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const totalCost = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * Math.round((Number(line.unitCost) || 0) * 100),
    0,
  );

  return (
    <ActionForm action={createIncomingStockAction} className="space-y-4">
      <section className="card">
        <div className="card-header"><h2 className="card-title">Shipment details</h2></div>
        <div className="card-body grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="in-reference">Reference</label>
            <input id="in-reference" name="reference" className="input" required maxLength={60} placeholder="Supplier invoice no." />
            <ContextFieldError name="reference" />
          </div>
          <div className="field">
            <label className="label" htmlFor="in-supplier">Supplier</label>
            <input id="in-supplier" name="supplierName" className="input" required maxLength={160} />
            <ContextFieldError name="supplierName" />
          </div>
          <div className="field">
            <label className="label" htmlFor="in-phone">Supplier phone</label>
            <input id="in-phone" name="supplierPhone" className="input" maxLength={30} />
          </div>
          <div className="field">
            <label className="label" htmlFor="in-expected">Expected on</label>
            <input id="in-expected" name="expectedAt" type="date" className="input" />
          </div>
          {warehouses.length > 0 ? (
            <div className="field">
              <label className="label" htmlFor="in-warehouse">Arriving at</label>
              <select id="in-warehouse" name="warehouseId" className="select">
                <option value="">Not tracked</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label className="label" htmlFor="in-shipping">Freight &amp; handling</label>
            <input id="in-shipping" name="shippingCost" type="number" step="0.01" min="0" className="input" placeholder="0.00" />
          </div>
          <div className="field sm:col-span-2">
            <label className="label" htmlFor="in-note">Note</label>
            <textarea id="in-note" name="note" rows={2} className="textarea" maxLength={500} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title">What is coming</h2></div>
        <div className="card-body space-y-3">
          <div className="field">
            <label className="label" htmlFor="in-search">Add a product</label>
            <input
              id="in-search"
              className="input"
              placeholder="Search by name or SKU"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <ul className="picker-results mt-2">
                {filtered.map((option) => (
                  <li key={option.id}>
                    <button type="button" className="picker-option" onClick={() => addLine(option)}>
                      {option.label}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 ? <li className="muted-xs px-3 py-2">Nothing matches.</li> : null}
              </ul>
            ) : null}
          </div>

          {lines.length === 0 ? (
            <p className="muted">No lines yet. Search above to add what the supplier is sending.</p>
          ) : (
            <div className="table-wrap">
              <table className="table table-compact">
                <thead>
                  <tr><th>Product</th><th className="text-right">Quantity</th><th className="text-right">Unit cost</th><th className="text-right">Line total</th><th></th></tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <span className="clamp-1">{line.label}</span>
                        <input type="hidden" name="productIds" value={line.productId} />
                        <input type="hidden" name="variantIds" value={line.variantId} />
                      </td>
                      <td className="text-right">
                        <input
                          name="quantities"
                          type="number"
                          min="1"
                          className="input h-9 w-24 text-right"
                          value={line.quantity}
                          onChange={(event) => update(line.key, { quantity: event.target.value })}
                          required
                        />
                      </td>
                      <td className="text-right">
                        <input
                          name="unitCosts"
                          type="number"
                          min="0"
                          step="0.01"
                          className="input h-9 w-28 text-right"
                          value={line.unitCost}
                          onChange={(event) => update(line.key, { unitCost: event.target.value })}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="td-num">
                        {formatMoney((Number(line.quantity) || 0) * Math.round((Number(line.unitCost) || 0) * 100))}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn-danger-soft btn-xs"
                          onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lines.length > 0 ? (
            <p className="muted-xs">
              {totalUnits} unit(s), {formatMoney(totalCost)} before freight.
            </p>
          ) : null}
        </div>
      </section>

      <SubmitButton>Record shipment</SubmitButton>
    </ActionForm>
  );
}
