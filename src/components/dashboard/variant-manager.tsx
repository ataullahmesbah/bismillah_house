"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteVariantAction, generateVariantsAction, saveVariantsAction, setProductAttributesAction,
} from "@/app/actions/dashboard/variants";
import { FormFeedback, QuickActionForm, SubmitButton } from "./action-form";
import { Field } from "@/components/ui";
import { idleState } from "@/lib/api";
import { fromMinor, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type AttributeOptionRow = { id: string; label: string; value: string; colorHex: string | null };
export type AttributeRow = { id: string; name: string; unit: string | null; type: string; options: AttributeOptionRow[] };
export type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
  optionIds: string[];
  orderCount: number;
};

/**
 * ADVANCED VARIANT MANAGER
 *
 * Step 1 — choose which reusable attributes this product uses.
 * Step 2 — tick the option values in play and generate the combinations.
 * Step 3 — edit price, stock, SKU and image per combination.
 *
 * Attributes are arbitrary (Size, Colour, Weight, Volume, Shoe Size, Pack…),
 * so a 500g / 1kg / 2kg product works the same way as S/M/L × Black/White.
 */
export function VariantManager({
  productId,
  productName,
  basePrice,
  attributes,
  selectedAttributeIds,
  variants,
}: {
  productId: string;
  productName: string;
  basePrice: number;
  attributes: AttributeRow[];
  selectedAttributeIds: string[];
  variants: VariantRow[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(selectedAttributeIds);

  const [attrState, attrAction, attrPending] = useActionState(setProductAttributesAction, idleState);
  const [genState, genAction, genPending] = useActionState(generateVariantsAction, idleState);
  const [saveState, saveAction, savePending] = useActionState(saveVariantsAction, idleState);

  useEffect(() => {
    if (attrState.status === "success" || genState.status === "success" || saveState.status === "success") {
      router.refresh();
    }
  }, [attrState, genState, saveState, router]);

  const persistedAttributes = attributes.filter((attribute) => selectedAttributeIds.includes(attribute.id));

  const optionLabel = (optionId: string) => {
    for (const attribute of attributes) {
      const option = attribute.options.find((row) => row.id === optionId);
      if (option) return `${attribute.name}: ${option.label}`;
    }
    return optionId;
  };

  return (
    <div className="stack">
      {/* Step 1 — attributes */}
      <form action={attrAction} className="card">
        <div className="card-header">
          <h2 className="card-title">1. Variant attributes</h2>
          <span className="muted-xs">Up to 6</span>
        </div>
        <div className="card-body stack">
          <FormFeedback state={attrState} />
          <input type="hidden" name="productId" value={productId} />
          {chosen.map((attributeId) => (
            <input key={attributeId} type="hidden" name="attributeIds" value={attributeId} />
          ))}

          {attributes.length === 0 ? (
            <p className="muted">
              No attributes exist yet. Create some in <Link href="/dashboard/attributes" className="link">Attributes &amp; variants</Link> first.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {attributes.map((attribute) => {
                const active = chosen.includes(attribute.id);
                return (
                  <button
                    key={attribute.id}
                    type="button"
                    onClick={() =>
                      setChosen((current) =>
                        current.includes(attribute.id)
                          ? current.filter((id) => id !== attribute.id)
                          : current.length < 6
                            ? [...current, attribute.id]
                            : current,
                      )
                    }
                    className={cn("check-row text-left", active && "check-row-active")}
                    aria-pressed={active}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {attribute.name}
                        {attribute.unit ? ` (${attribute.unit})` : ""}
                      </span>
                      <span className="block text-xs text-brand-500">{attribute.options.length} options</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="card-footer">
          <SubmitButton pending={attrPending} className="btn-secondary">Save attributes</SubmitButton>
        </div>
      </form>

      {/* Step 2 — generate combinations */}
      {persistedAttributes.length > 0 ? (
        <form action={genAction} className="card">
          <div className="card-header">
            <h2 className="card-title">2. Generate combinations</h2>
            <span className="muted-xs">Existing variants are kept</span>
          </div>
          <div className="card-body stack">
            <FormFeedback state={genState} />
            <input type="hidden" name="productId" value={productId} />

            {persistedAttributes.map((attribute) => (
              <fieldset key={attribute.id} className="fieldset">
                <legend className="fieldset-legend">
                  {attribute.name}
                  {attribute.unit ? ` (${attribute.unit})` : ""}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {attribute.options.map((option) => (
                    <label key={option.id} className="chip cursor-pointer has-checked:border-brand-900 has-checked:bg-brand-900 has-checked:text-white">
                      <input
                        type="checkbox"
                        name={`options_${attribute.id}`}
                        value={option.id}
                        className="sr-only"
                        defaultChecked
                      />
                      {option.colorHex ? (
                        <span className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: option.colorHex }} aria-hidden="true" />
                      ) : null}
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <div className="grid-form-2">
              <Field label="Starting price for new variants (৳)" htmlFor="basePrice" hint="Each variant can be priced individually afterwards.">
                <input id="basePrice" name="basePrice" type="number" step="0.01" min="0" className="input" defaultValue={fromMinor(basePrice)} />
              </Field>
              <Field label="Starting stock" htmlFor="baseStock">
                <input id="baseStock" name="baseStock" type="number" min="0" className="input" defaultValue={0} />
              </Field>
            </div>
          </div>
          <div className="card-footer">
            <SubmitButton pending={genPending} className="btn-primary">Generate variants</SubmitButton>
          </div>
        </form>
      ) : null}

      {/* Step 3 — matrix editor */}
      {variants.length > 0 ? (
        <form action={saveAction} className="card">
          <div className="card-header">
            <h2 className="card-title">3. Variant pricing &amp; stock ({variants.length})</h2>
            <span className="muted-xs">Cheapest active variant becomes the product price</span>
          </div>

          <FormFeedback state={saveState} className="mx-5 mt-4" />
          <input type="hidden" name="productId" value={productId} />

          <div className="table-wrap border-0">
            <table className="table min-w-[56rem]">
              <thead>
                <tr>
                  <th>Combination</th>
                  <th>SKU</th>
                  <th className="text-right">Price (৳)</th>
                  <th className="text-right">Compare (৳)</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Low at</th>
                  <th>Image URL</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td>
                      <input type="hidden" name="variantIds" value={variant.id} />
                      <p className="font-semibold">{variant.name}</p>
                      <p className="muted-xs">{variant.optionIds.map(optionLabel).join(" · ")}</p>
                      {variant.orderCount > 0 ? (
                        <p className="muted-xs">{variant.orderCount} order(s)</p>
                      ) : null}
                    </td>
                    <td>
                      <input name={`sku_${variant.id}`} className="input w-28 text-xs" defaultValue={variant.sku ?? ""} maxLength={60} />
                    </td>
                    <td>
                      <input
                        name={`price_${variant.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="input w-24 text-right"
                        defaultValue={fromMinor(variant.price)}
                      />
                    </td>
                    <td>
                      <input
                        name={`compareAtPrice_${variant.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-24 text-right"
                        defaultValue={variant.compareAtPrice ? fromMinor(variant.compareAtPrice) : ""}
                      />
                    </td>
                    <td>
                      <input name={`stock_${variant.id}`} type="number" min="0" className="input w-20 text-right" defaultValue={variant.stock} />
                    </td>
                    <td>
                      <input name={`lowStockThreshold_${variant.id}`} type="number" min="0" className="input w-16 text-right" defaultValue={variant.lowStockThreshold} />
                    </td>
                    <td>
                      <input name={`imageUrl_${variant.id}`} className="input w-40 text-xs" defaultValue={variant.imageUrl ?? ""} placeholder="https://…" />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" name={`isActive_${variant.id}`} className="checkbox" defaultChecked={variant.isActive} />
                    </td>
                    <td className="td-actions">
                      <QuickActionForm
                        action={deleteVariantAction}
                        values={{ variantId: variant.id }}
                        label="Delete"
                        className="btn-danger-soft btn-xs"
                        confirm={
                          variant.orderCount > 0
                            ? "This variant has orders and will be deactivated instead of deleted. Continue?"
                            : `Delete variant “${variant.name}”?`
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-footer">
            <p className="muted-xs mr-auto">
              Total stock across active variants:{" "}
              <strong>{variants.filter((v) => v.isActive).reduce((sum, v) => sum + v.stock, 0)}</strong>
              {" · from "}
              <strong>{formatMoney(Math.min(...variants.filter((v) => v.isActive).map((v) => v.price), basePrice))}</strong>
            </p>
            <SubmitButton pending={savePending}>Save all variants</SubmitButton>
          </div>
        </form>
      ) : persistedAttributes.length > 0 ? (
        <div className="alert-info">
          <div>No variants yet for <strong>{productName}</strong>. Pick the option values above and generate them.</div>
        </div>
      ) : null}
    </div>
  );
}
