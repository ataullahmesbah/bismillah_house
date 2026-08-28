"use client";

import { useMemo, useState } from "react";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { adjustStockAction } from "@/app/actions/dashboard/inventory";
import { ADJUSTMENT_REASONS, type AdjustmentReason } from "@/lib/services/inventory.shared";

export type AdjustTarget = {
  /** Variant id when this row is a variant, otherwise the product id. */
  id: string;
  productId: string;
  variantId: string | null;
  label: string;
  available: number;
};

/**
 * Records one manual stock movement.
 *
 * The quantity box is always a positive number and the chosen reason decides
 * which way it moves — asking someone to type "-3" for damage is how a
 * write-off ends up adding stock. Corrections are the exception and say so.
 */
export function StockAdjuster({
  targets,
  warehouses,
  defaultTargetId,
}: {
  targets: AdjustTarget[];
  warehouses: Array<{ id: string; name: string }>;
  defaultTargetId?: string;
}) {
  const [targetId, setTargetId] = useState(defaultTargetId ?? targets[0]?.id ?? "");
  const [reason, setReason] = useState<AdjustmentReason>("RECEIVED");
  const [query, setQuery] = useState("");

  const target = targets.find((item) => item.id === targetId);
  const rule = ADJUSTMENT_REASONS[reason];
  const isTransfer = reason === "TRANSFER";
  const signed = rule.delta === "either";

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term ? targets.filter((item) => item.label.toLowerCase().includes(term)) : targets;
    return pool.slice(0, 200);
  }, [targets, query]);

  return (
    <ActionForm action={adjustStockAction} className="card-body space-y-4" successRedirect={false}>
      <input type="hidden" name="productId" value={target?.productId ?? ""} />
      <input type="hidden" name="variantId" value={target?.variantId ?? ""} />

      <div className="field">
        <label className="label" htmlFor="stock-target-search">Product</label>
        <input
          id="stock-target-search"
          className="input mb-2"
          placeholder="Search by name or SKU"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="select"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          size={Math.min(6, Math.max(2, filtered.length))}
          aria-label="Product to adjust"
        >
          {filtered.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} — {item.available} available
            </option>
          ))}
        </select>
        <ContextFieldError name="productId" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="stock-reason">Reason</label>
          <select
            id="stock-reason"
            name="reason"
            className="select"
            value={reason}
            onChange={(event) => setReason(event.target.value as AdjustmentReason)}
          >
            {Object.entries(ADJUSTMENT_REASONS).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
          <ContextFieldError name="reason" />
        </div>

        <div className="field">
          <label className="label" htmlFor="stock-quantity">
            {signed ? "Change (+ adds, − removes)" : rule.delta === "increase" ? "Units to add" : "Units to remove"}
          </label>
          <input
            id="stock-quantity"
            name="quantity"
            type="number"
            step="1"
            min={signed ? undefined : 1}
            className="input"
            defaultValue={signed ? "" : "1"}
            placeholder={signed ? "e.g. -3" : "e.g. 12"}
            required
          />
          <ContextFieldError name="quantity" />
        </div>
      </div>

      {warehouses.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="stock-warehouse">{isTransfer ? "From warehouse" : "Warehouse"}</label>
            <select id="stock-warehouse" name="warehouseId" className="select" required={isTransfer}>
              {!isTransfer ? <option value="">Not tracked</option> : null}
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
            <ContextFieldError name="warehouseId" />
          </div>

          {isTransfer ? (
            <div className="field">
              <label className="label" htmlFor="stock-to-warehouse">To warehouse</label>
              <select id="stock-to-warehouse" name="toWarehouseId" className="select" required>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
              <p className="form-hint">A transfer moves stock between sites; the sellable total does not change.</p>
              <ContextFieldError name="toWarehouseId" />
            </div>
          ) : (
            <div className="field">
              <label className="label" htmlFor="stock-cost">Unit cost (optional)</label>
              <input id="stock-cost" name="unitCost" type="number" step="0.01" min="0" className="input" placeholder="0.00" />
              <p className="form-hint">Used to value the stock in reports.</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="field">
        <label className="label" htmlFor="stock-note">Note</label>
        <textarea
          id="stock-note"
          name="note"
          rows={2}
          className="textarea"
          maxLength={300}
          placeholder="e.g. two boxes crushed in transit"
        />
        <p className="form-hint">Stored on the movement so the reason survives the person who typed it.</p>
        <ContextFieldError name="note" />
      </div>

      {target ? (
        <p className="muted-xs">
          {target.label} currently has <strong>{target.available}</strong> available.
        </p>
      ) : null}

      <SubmitButton>Record adjustment</SubmitButton>
    </ActionForm>
  );
}
