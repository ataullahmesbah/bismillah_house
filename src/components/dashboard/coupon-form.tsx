"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "./action-form";
import { MultiPicker, type PickerOption } from "./pickers";
import { Field } from "@/components/ui";
import { saveCouponAction } from "@/app/actions/dashboard/marketing";
import { fromMinor } from "@/lib/money";
import type { CouponFormValues } from "@/lib/forms/marketing-defaults";

export type { CouponFormValues };

/**
 * Coupon editor covering the full PRD update §1 rule set: fixed or percentage,
 * global / product-specific / category scope, exact start & end date-time (so a
 * two-hour coupon is just a two-hour window), usage limits, per-customer
 * limits, flash-sale eligibility and stacking control.
 */
export function CouponForm({
  values,
  products,
  categories,
}: {
  values: CouponFormValues;
  products: PickerOption[];
  categories: PickerOption[];
}) {
  const [scope, setScope] = useState(values.scope);
  const [discountType, setDiscountType] = useState(values.discountType);

  return (
    <ActionForm action={saveCouponAction} className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      {({ pending, fields }) => (
        <>
          <input type="hidden" name="id" value={values.id ?? ""} />

          <div className="stack">
            <section className="card">
              <div className="card-header"><h2 className="card-title">Coupon</h2></div>
              <div className="card-body stack">
                <div className="grid-form-2">
                  <Field label="Code" htmlFor="code" required error={fields.code} hint="Customers type this at checkout.">
                    <input id="code" name="code" className="input uppercase" defaultValue={values.code} required maxLength={40} placeholder="EID100" />
                  </Field>
                  <Field label="Internal title" htmlFor="title" required error={fields.title}>
                    <input id="title" name="title" className="input" defaultValue={values.title} required maxLength={160} placeholder="Eid ৳100 off dates" />
                  </Field>
                </div>
                <Field label="Description" htmlFor="description" error={fields.description} hint="Optional note shown to customers where relevant.">
                  <textarea id="description" name="description" className="textarea min-h-16" defaultValue={values.description} maxLength={600} />
                </Field>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2 className="card-title">Discount</h2></div>
              <div className="card-body stack">
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["PERCENT", "Percentage", "e.g. 10% off eligible items"],
                    ["FIXED", "Fixed amount", "e.g. ৳100 off"],
                  ] as const).map(([type, title, hint]) => (
                    <label key={type} className={`check-row ${discountType === type ? "check-row-active" : ""}`}>
                      <input
                        type="radio"
                        name="discountType"
                        value={type}
                        className="radio mt-0.5"
                        checked={discountType === type}
                        onChange={() => setDiscountType(type)}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{title}</span>
                        <span className="block text-xs text-brand-500">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="grid-form-3">
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
                  <Field label="Minimum cart (৳)" htmlFor="minOrderAmount" error={fields.minOrderAmount}>
                    <input id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" min="0" className="input" defaultValue={fromMinor(values.minOrderAmount)} />
                  </Field>
                  <Field
                    label="Maximum discount (৳)"
                    htmlFor="maxDiscountAmount"
                    error={fields.maxDiscountAmount}
                    hint={discountType === "PERCENT" ? "Caps a percentage coupon." : "Optional."}
                  >
                    <input id="maxDiscountAmount" name="maxDiscountAmount" type="number" step="0.01" min="0" className="input" defaultValue={values.maxDiscountAmount ? fromMinor(values.maxDiscountAmount) : ""} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Eligibility</h2>
                <span className="muted-xs">Checked again on the server at checkout</span>
              </div>
              <div className="card-body stack">
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["GLOBAL", "All products", "Applies across the whole catalogue."],
                    ["PRODUCT", "Selected products", "Only the products you pick."],
                    ["CATEGORY", "Selected categories", "Everything in the chosen categories."],
                  ] as const).map(([value, title, hint]) => (
                    <label key={value} className={`check-row ${scope === value ? "check-row-active" : ""}`}>
                      <input
                        type="radio"
                        name="scope"
                        value={value}
                        className="radio mt-0.5"
                        checked={scope === value}
                        onChange={() => setScope(value)}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{title}</span>
                        <span className="block text-xs text-brand-500">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {scope === "PRODUCT" ? (
                  <MultiPicker
                    name="productIds"
                    label="Eligible products"
                    options={products}
                    defaultSelected={values.productIds}
                    emptyHint="Pick at least one product for a product-specific coupon."
                  />
                ) : null}

                {scope === "CATEGORY" ? (
                  <MultiPicker
                    name="categoryIds"
                    label="Eligible categories"
                    options={categories}
                    defaultSelected={values.categoryIds}
                    emptyHint="Pick at least one category."
                  />
                ) : null}

                <MultiPicker
                  name="excludedProductIds"
                  label="Excluded products (optional)"
                  options={products}
                  defaultSelected={values.excludedProductIds}
                  emptyHint="No exclusions."
                />

                <label className="check-row">
                  <input type="checkbox" name="allowOnFlashSale" className="checkbox mt-0.5" defaultChecked={values.allowOnFlashSale} />
                  <span className="min-w-0">
                    <span className="block font-semibold">Allow on flash-sale items</span>
                    <span className="block text-xs text-brand-500">Off by default so campaigns are not double-discounted.</span>
                  </span>
                </label>
                <label className="check-row">
                  <input type="checkbox" name="allowStacking" className="checkbox mt-0.5" defaultChecked={values.allowStacking} />
                  <span className="min-w-0">
                    <span className="block font-semibold">Allow stacking with promotional offers</span>
                    <span className="block text-xs text-brand-500">Off by default — items already discounted by an offer are skipped.</span>
                  </span>
                </label>
              </div>
            </section>
          </div>

          <aside className="stack lg:sticky lg:top-20 lg:self-start">
            <section className="card">
              <div className="card-header"><h2 className="card-title">Schedule</h2></div>
              <div className="card-body stack">
                <Field label="Starts" htmlFor="startAt" required error={fields.startAt}>
                  <input id="startAt" name="startAt" type="datetime-local" className="input" defaultValue={values.startAt} required />
                </Field>
                <Field
                  label="Ends"
                  htmlFor="endAt"
                  required
                  error={fields.endAt}
                  hint="Set both to the same day two hours apart for a short flash coupon."
                >
                  <input id="endAt" name="endAt" type="datetime-local" className="input" defaultValue={values.endAt} required />
                </Field>
                <label className="check-row">
                  <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={values.isActive} />
                  <span>Active</span>
                </label>
              </div>
              <div className="card-footer">
                <SubmitButton pending={pending}>{values.id ? "Save coupon" : "Create coupon"}</SubmitButton>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2 className="card-title">Usage limits</h2></div>
              <div className="card-body stack">
                <Field label="Total uses" htmlFor="usageLimit" error={fields.usageLimit} hint="Blank = unlimited.">
                  <input id="usageLimit" name="usageLimit" type="number" min="0" className="input" defaultValue={values.usageLimit ?? ""} />
                </Field>
                <Field label="Uses per customer" htmlFor="perCustomerLimit" error={fields.perCustomerLimit} hint="Blank = unlimited.">
                  <input id="perCustomerLimit" name="perCustomerLimit" type="number" min="0" className="input" defaultValue={values.perCustomerLimit ?? ""} />
                </Field>
              </div>
            </section>
          </aside>
        </>
      )}
    </ActionForm>
  );
}
