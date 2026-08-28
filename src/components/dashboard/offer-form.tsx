"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "./action-form";
import { MultiPicker, type PickerOption } from "./pickers";
import { Field } from "@/components/ui";
import { saveOfferAction } from "@/app/actions/dashboard/marketing";
import { fromMinor } from "@/lib/money";
import { toDateTimeLocalValue } from "@/lib/utils";
import type { OfferFormValues } from "@/lib/forms/marketing-defaults";

export type { OfferFormValues };

/**
 * Promotional offer editor (PRD update §2). Defaults to a two-hour window so
 * short campaigns are the easy path; the countdown on the storefront is display
 * only — the price is recalculated server-side at checkout.
 */
export function OfferForm({
  values,
  products,
  categories,
}: {
  values: OfferFormValues;
  products: PickerOption[];
  categories: PickerOption[];
}) {
  const [scope, setScope] = useState(values.scope);
  const [discountType, setDiscountType] = useState(values.discountType);

  function setQuickWindow(hours: number) {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const startInput = document.getElementById("startAt") as HTMLInputElement | null;
    const endInput = document.getElementById("endAt") as HTMLInputElement | null;
    if (startInput) startInput.value = toDateTimeLocalValue(now);
    if (endInput) endInput.value = toDateTimeLocalValue(end);
  }

  return (
    <ActionForm action={saveOfferAction} className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      {({ pending, fields }) => (
        <>
          <input type="hidden" name="id" value={values.id ?? ""} />

          <div className="stack">
            <section className="card">
              <div className="card-header"><h2 className="card-title">Offer</h2></div>
              <div className="card-body stack">
                <Field label="Title" htmlFor="title" required error={fields.title}>
                  <input id="title" name="title" className="input" defaultValue={values.title} required maxLength={160} placeholder="2-hour flash offer on dates" />
                </Field>
                <Field label="Description" htmlFor="description" error={fields.description}>
                  <textarea id="description" name="description" className="textarea min-h-16" defaultValue={values.description} maxLength={600} />
                </Field>
                <div className="grid-form-2">
                  <Field label="Badge text" htmlFor="badgeText" hint="Shown on the product card.">
                    <input id="badgeText" name="badgeText" className="input" defaultValue={values.badgeText} maxLength={40} />
                  </Field>
                  <Field label="Priority" htmlFor="priority" hint="Higher wins when several offers match.">
                    <input id="priority" name="priority" type="number" min="0" className="input" defaultValue={values.priority} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2 className="card-title">Discount</h2></div>
              <div className="card-body stack">
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["PERCENT", "Percentage off"],
                    ["FIXED", "Fixed amount off"],
                  ] as const).map(([type, title]) => (
                    <label key={type} className={`check-row ${discountType === type ? "check-row-active" : ""}`}>
                      <input
                        type="radio"
                        name="discountType"
                        value={type}
                        className="radio mt-0.5"
                        checked={discountType === type}
                        onChange={() => setDiscountType(type)}
                      />
                      <span className="font-semibold">{title}</span>
                    </label>
                  ))}
                </div>
                <div className="grid-form-2">
                  <Field
                    label={discountType === "PERCENT" ? "Discount (%)" : "Discount (৳)"}
                    htmlFor="discountValue"
                    required
                    error={fields.discountValue}
                  >
                    <input
                      id="discountValue"
                      name="discountValue"
                      type="number"
                      step={discountType === "PERCENT" ? "1" : "0.01"}
                      min="0"
                      max={discountType === "PERCENT" ? 100 : undefined}
                      className="input"
                      defaultValue={discountType === "PERCENT" ? values.discountValue : fromMinor(values.discountValue)}
                      required
                    />
                  </Field>
                  <Field label="Maximum discount (৳)" htmlFor="maxDiscountAmount" hint="Optional cap per item.">
                    <input id="maxDiscountAmount" name="maxDiscountAmount" type="number" step="0.01" min="0" className="input" defaultValue={values.maxDiscountAmount ? fromMinor(values.maxDiscountAmount) : ""} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2 className="card-title">Applies to</h2></div>
              <div className="card-body stack">
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["GLOBAL", "Everything"],
                    ["PRODUCT", "Selected products"],
                    ["CATEGORY", "Selected categories"],
                  ] as const).map(([value, title]) => (
                    <label key={value} className={`check-row ${scope === value ? "check-row-active" : ""}`}>
                      <input
                        type="radio"
                        name="scope"
                        value={value}
                        className="radio mt-0.5"
                        checked={scope === value}
                        onChange={() => setScope(value)}
                      />
                      <span className="font-semibold">{title}</span>
                    </label>
                  ))}
                </div>

                {scope === "PRODUCT" ? (
                  <MultiPicker name="productIds" label="Products" options={products} defaultSelected={values.productIds} />
                ) : null}
                {scope === "CATEGORY" ? (
                  <MultiPicker name="categoryIds" label="Categories" options={categories} defaultSelected={values.categoryIds} />
                ) : null}
              </div>
            </section>
          </div>

          <aside className="stack lg:sticky lg:top-20 lg:self-start">
            <section className="card">
              <div className="card-header"><h2 className="card-title">Schedule</h2></div>
              <div className="card-body stack">
                <div className="flex flex-wrap gap-1.5">
                  {[2, 6, 24, 72].map((hours) => (
                    <button key={hours} type="button" className="chip" onClick={() => setQuickWindow(hours)}>
                      {hours}h from now
                    </button>
                  ))}
                </div>

                <Field label="Starts" htmlFor="startAt" required error={fields.startAt}>
                  <input id="startAt" name="startAt" type="datetime-local" className="input" defaultValue={values.startAt} required />
                </Field>
                <Field label="Ends" htmlFor="endAt" required error={fields.endAt} hint="The offer expires automatically at this moment.">
                  <input id="endAt" name="endAt" type="datetime-local" className="input" defaultValue={values.endAt} required />
                </Field>

                <label className="check-row">
                  <input type="checkbox" name="showCountdown" className="checkbox mt-0.5" defaultChecked={values.showCountdown} />
                  <span>Show a countdown on the storefront</span>
                </label>
                <label className="check-row">
                  <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={values.isActive} />
                  <span>Active</span>
                </label>
              </div>
              <div className="card-footer">
                <SubmitButton pending={pending}>{values.id ? "Save offer" : "Create offer"}</SubmitButton>
              </div>
            </section>
          </aside>
        </>
      )}
    </ActionForm>
  );
}
