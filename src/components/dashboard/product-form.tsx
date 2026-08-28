"use client";

import type { ProductStatus } from "@/generated/prisma/client";

import Link from "next/link";

import { ActionForm, SubmitButton } from "./action-form";
import { ImageUploadField } from "./image-upload";
import { Field } from "@/components/ui";
import { saveProductAction } from "@/app/actions/dashboard/catalog";
import { fromMinor } from "@/lib/money";
import { useState } from "react";

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  brandId: string;
  shortDescription: string;
  description: string;
  specifications: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  weightGrams: number | null;
  tags: string;
  status: ProductStatus;
  isFeatured: boolean;
  isTopSelling: boolean;
  manualRank: number;
  shippingMode: "STANDARD" | "FREE" | "FIXED";
  shippingFlatFee: number | null;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImageUrl: string;
  noIndex: boolean;
};

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "", slug: "", sku: "", categoryId: "", brandId: "",
  shortDescription: "", description: "", specifications: "",
  price: 0, compareAtPrice: null, costPrice: null,
  stock: 0, lowStockThreshold: 5, weightGrams: null, tags: "",
  status: "DRAFT", isFeatured: false, isTopSelling: false, manualRank: 0,
  shippingMode: "STANDARD", shippingFlatFee: null,
  seoTitle: "", seoDescription: "", canonicalUrl: "", ogImageUrl: "", noIndex: false,
};

const taka = (minor: number | null) => (minor === null ? "" : String(fromMinor(minor)));

export function ProductForm({
  values,
  categories,
  brands,
  uploadRecommendation,
}: {
  values: ProductFormValues;
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  uploadRecommendation: string;
}) {
  const [shippingMode, setShippingMode] = useState(values.shippingMode);

  return (
    <ActionForm action={saveProductAction} className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      {({ pending, fields }) => (
        <>
          <input type="hidden" name="id" value={values.id ?? ""} />

          <div className="stack">
            <section className="card">
              <div className="card-header"><h2 className="card-title">Product details</h2></div>
              <div className="card-body stack">
                <Field label="Product name" htmlFor="name" required error={fields.name}>
                  <input id="name" name="name" className="input" defaultValue={values.name} required maxLength={200} />
                </Field>

                <div className="grid-form-2">
                  <Field label="URL slug" htmlFor="slug" error={fields.slug} hint="Leave blank to generate from the name.">
                    <input id="slug" name="slug" className="input" defaultValue={values.slug} maxLength={140} />
                  </Field>
                  <Field label="SKU" htmlFor="sku" error={fields.sku} hint="Base SKU. Variants get their own.">
                    <input id="sku" name="sku" className="input" defaultValue={values.sku} maxLength={60} />
                  </Field>
                </div>

                <Field label="Short description" htmlFor="shortDescription" error={fields.shortDescription} hint="Shown on cards and in search results.">
                  <textarea id="shortDescription" name="shortDescription" className="textarea min-h-20" defaultValue={values.shortDescription} maxLength={500} />
                </Field>

                <Field label="Full description" htmlFor="description" error={fields.description}>
                  <textarea id="description" name="description" className="textarea min-h-40" defaultValue={values.description} maxLength={20000} />
                </Field>

                <Field
                  label="Specifications"
                  htmlFor="specifications"
                  error={fields.specifications}
                  hint="One per line as “Label: value”, e.g. “Material: Cotton”."
                >
                  <textarea id="specifications" name="specifications" className="textarea min-h-28 font-mono text-xs" defaultValue={values.specifications} maxLength={8000} />
                </Field>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2 className="card-title">Pricing & stock</h2></div>
              <div className="card-body grid-form-3">
                <Field label="Price (৳)" htmlFor="price" required error={fields.price}>
                  <input id="price" name="price" type="number" step="0.01" min="0" className="input" defaultValue={taka(values.price)} required />
                </Field>
                <Field label="Compare-at price (৳)" htmlFor="compareAtPrice" error={fields.compareAtPrice} hint="Shown struck through.">
                  <input id="compareAtPrice" name="compareAtPrice" type="number" step="0.01" min="0" className="input" defaultValue={taka(values.compareAtPrice)} />
                </Field>
                <Field label="Cost price (৳)" htmlFor="costPrice" error={fields.costPrice} hint="Internal only.">
                  <input id="costPrice" name="costPrice" type="number" step="0.01" min="0" className="input" defaultValue={taka(values.costPrice)} />
                </Field>
                <Field label="Stock" htmlFor="stock" error={fields.stock} hint="Ignored once variants exist.">
                  <input id="stock" name="stock" type="number" min="0" className="input" defaultValue={values.stock} />
                </Field>
                <Field label="Low stock alert at" htmlFor="lowStockThreshold" error={fields.lowStockThreshold}>
                  <input id="lowStockThreshold" name="lowStockThreshold" type="number" min="0" className="input" defaultValue={values.lowStockThreshold} />
                </Field>
                <Field label="Weight (grams)" htmlFor="weightGrams" error={fields.weightGrams}>
                  <input id="weightGrams" name="weightGrams" type="number" min="0" className="input" defaultValue={values.weightGrams ?? ""} />
                </Field>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Delivery</h2>
                <span className="muted-xs">Overrides the district charge</span>
              </div>
              <div className="card-body stack">
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["STANDARD", "District standard", "Use the delivery charge of the customer's district."],
                    ["FREE", "Free delivery", "This product never adds a delivery charge."],
                    ["FIXED", "Custom fixed charge", "Always bill a specific amount for this product."],
                  ] as const).map(([mode, title, hint]) => (
                    <label key={mode} className={`check-row ${shippingMode === mode ? "check-row-active" : ""}`}>
                      <input
                        type="radio"
                        name="shippingMode"
                        value={mode}
                        className="radio mt-0.5"
                        checked={shippingMode === mode}
                        onChange={() => setShippingMode(mode)}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{title}</span>
                        <span className="block text-xs text-brand-500">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {shippingMode === "FIXED" ? (
                  <Field label="Fixed delivery charge (৳)" htmlFor="shippingFlatFee" required error={fields.shippingFlatFee}>
                    <input id="shippingFlatFee" name="shippingFlatFee" type="number" step="0.01" min="0" className="input" defaultValue={taka(values.shippingFlatFee)} />
                  </Field>
                ) : (
                  <input type="hidden" name="shippingFlatFee" value="" />
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2 className="card-title">Search engine listing</h2></div>
              <div className="card-body stack">
                <Field label="SEO title" htmlFor="seoTitle" error={fields.seoTitle} hint="Defaults to the product name.">
                  <input id="seoTitle" name="seoTitle" className="input" defaultValue={values.seoTitle} maxLength={200} />
                </Field>
                <Field label="Meta description" htmlFor="seoDescription" error={fields.seoDescription}>
                  <textarea id="seoDescription" name="seoDescription" className="textarea min-h-20" defaultValue={values.seoDescription} maxLength={400} />
                </Field>
                <div className="grid-form-2">
                  <Field label="Canonical URL" htmlFor="canonicalUrl" error={fields.canonicalUrl}>
                    <input id="canonicalUrl" name="canonicalUrl" className="input" defaultValue={values.canonicalUrl} maxLength={2048} />
                  </Field>
                  <Field label="Open Graph image" htmlFor="ogImageUrl" error={fields.ogImageUrl}>
                    <input id="ogImageUrl" name="ogImageUrl" className="input" defaultValue={values.ogImageUrl} maxLength={2048} />
                  </Field>
                </div>
                <label className="check-row">
                  <input type="checkbox" name="noIndex" defaultChecked={values.noIndex} className="checkbox mt-0.5" />
                  <span>Hide this product from search engines (noindex)</span>
                </label>
              </div>
            </section>
          </div>

          <aside className="stack lg:sticky lg:top-20 lg:self-start">
            <section className="card">
              <div className="card-header"><h2 className="card-title">Publishing</h2></div>
              <div className="card-body stack">
                <Field label="Status" htmlFor="status" error={fields.status}>
                  <select id="status" name="status" className="select" defaultValue={values.status}>
                    <option value="DRAFT">Draft — not visible</option>
                    <option value="PUBLISHED">Published — live on the shop</option>
                    <option value="ARCHIVED">Archived — hidden, history kept</option>
                  </select>
                </Field>

                <label className="check-row">
                  <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} className="checkbox mt-0.5" />
                  <span>Featured on the homepage</span>
                </label>
                <label className="check-row">
                  <input type="checkbox" name="isTopSelling" defaultChecked={values.isTopSelling} className="checkbox mt-0.5" />
                  <span>Pin to “Top selling”</span>
                </label>

                <Field label="Manual rank" htmlFor="manualRank" hint="Higher shows first in featured lists.">
                  <input id="manualRank" name="manualRank" type="number" min="0" className="input" defaultValue={values.manualRank} />
                </Field>
              </div>
              <div className="card-footer">
                <SubmitButton pending={pending}>{values.id ? "Save product" : "Create product"}</SubmitButton>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2 className="card-title">Organisation</h2></div>
              <div className="card-body stack">
                <Field label="Category" htmlFor="categoryId" error={fields.categoryId}>
                  <select id="categoryId" name="categoryId" className="select" defaultValue={values.categoryId}>
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Brand" htmlFor="brandId" error={fields.brandId}>
                  <select id="brandId" name="brandId" className="select" defaultValue={values.brandId}>
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tags" htmlFor="tags" hint="Comma separated. Used by search and the AI assistant.">
                  <input id="tags" name="tags" className="input" defaultValue={values.tags} maxLength={600} />
                </Field>
              </div>
            </section>

            {values.id ? (
              <section className="card">
                <div className="card-header"><h2 className="card-title">Next steps</h2></div>
                <div className="card-body stack">
                  <Link href={`/dashboard/products/${values.id}/variants`} className="btn-secondary btn-sm btn-block">
                    Manage variants
                  </Link>
                  <p className="form-hint">Images are managed below the form once the product exists.</p>
                </div>
              </section>
            ) : (
              <section className="card">
                <div className="card-header"><h2 className="card-title">Main image</h2></div>
                <div className="card-body">
                  <ImageUploadField
                    name="ogImageUrlUpload"
                    label="Upload after saving"
                    folder="products"
                    recommendation={uploadRecommendation}
                  />
                  <p className="form-hint mt-2">Save the product first, then add its gallery images.</p>
                </div>
              </section>
            )}

          </aside>
        </>
      )}
    </ActionForm>
  );
}
