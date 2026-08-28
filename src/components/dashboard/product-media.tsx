"use client";

import Image from "next/image";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  addProductImageAction, deleteProductImageAction, setPrimaryImageAction,
  saveRelatedProductsAction,
} from "@/app/actions/dashboard/catalog";
import { adjustInventoryAction } from "@/app/actions/dashboard/catalog";
import { ImageUploadField } from "./image-upload";
import { MultiPicker, type PickerOption } from "./pickers";
import { QuickActionForm, SubmitButton, FormFeedback } from "./action-form";
import { Field } from "@/components/ui";
import { idleState } from "@/lib/api";

export type ProductImageRow = { id: string; url: string; alt: string | null; isPrimary: boolean };

/** Gallery manager — upload, reorder by primary, and remove. */
export function ProductGalleryManager({
  productId,
  images,
  recommendation,
  maxSizeMb,
}: {
  productId: string;
  images: ProductImageRow[];
  recommendation: string;
  maxSizeMb: number;
}) {
  const [state, formAction, pending] = useActionState(addProductImageAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Images</h2>
        <span className="muted-xs">{images.length}/12</span>
      </div>

      <div className="card-body stack">
        <FormFeedback state={state} />

        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {images.map((image) => (
              <div key={image.id} className="stack gap-1">
                <div className="relative aspect-square overflow-hidden rounded-[var(--radius-tm)] border border-line bg-white">
                  <Image src={image.url} alt={image.alt ?? ""} fill sizes="120px" className="object-contain" />
                  {image.isPrimary ? <span className="discount-pill bg-brand-900">Main</span> : null}
                </div>
                <div className="flex gap-1">
                  {!image.isPrimary ? (
                    <QuickActionForm
                      action={setPrimaryImageAction}
                      values={{ imageId: image.id }}
                      label="Set main"
                      className="btn-ghost btn-xs flex-1"
                    />
                  ) : null}
                  <QuickActionForm
                    action={deleteProductImageAction}
                    values={{ imageId: image.id }}
                    label="Remove"
                    className="btn-danger-soft btn-xs flex-1"
                    confirm="Remove this image?"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No images yet. The first image you add becomes the main image.</p>
        )}

        <form action={formAction} className="panel stack">
          <input type="hidden" name="productId" value={productId} />
          <ImageUploadField
            name="url"
            label="Add an image"
            folder="products"
            recommendation={recommendation}
            maxSizeMb={maxSizeMb}
          />
          <Field label="Alt text" htmlFor="alt" hint="Describe the image for accessibility and SEO.">
            <input id="alt" name="alt" className="input" maxLength={200} />
          </Field>
          <SubmitButton pending={pending} className="btn-secondary self-start">Add image</SubmitButton>
        </form>
      </div>
    </section>
  );
}

/** Manual stock adjustment with a mandatory reason (recorded in the movement log). */
export function InventoryAdjustForm({
  productId,
  variants,
}: {
  productId: string;
  variants: Array<{ id: string; name: string; stock: number }>;
}) {
  const [state, formAction, pending] = useActionState(adjustInventoryAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">Adjust stock</h2></div>
      <div className="card-body stack">
        <FormFeedback state={state} />
        <input type="hidden" name="productId" value={productId} />

        {variants.length > 0 ? (
          <Field label="Variant" htmlFor="variantId">
            <select id="variantId" name="variantId" className="select" defaultValue="">
              <option value="">Base product</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} (stock {variant.stock})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="variantId" value="" />
        )}

        <Field label="Change" htmlFor="quantityChange" required hint="Use a negative number to reduce stock.">
          <input id="quantityChange" name="quantityChange" type="number" className="input" required placeholder="e.g. 25 or -3" />
        </Field>
        <Field label="Reason" htmlFor="reason" required>
          <input id="reason" name="reason" className="input" required maxLength={200} placeholder="Stock received, damaged, recount…" />
        </Field>
      </div>
      <div className="card-footer">
        <SubmitButton pending={pending} className="btn-secondary">Apply adjustment</SubmitButton>
      </div>
    </form>
  );
}

export function RelatedProductsForm({
  productId,
  options,
  defaultSelected,
}: {
  productId: string;
  options: PickerOption[];
  defaultSelected: string[];
}) {
  const [state, formAction, pending] = useActionState(saveRelatedProductsAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  // Re-key from the server data so a refreshed selection reseeds the picker.
  return (
    <form action={formAction} className="card" key={defaultSelected.join(",")}>
      <div className="card-header"><h2 className="card-title">Related products</h2></div>
      <div className="card-body">
        <FormFeedback state={state} />
        <input type="hidden" name="productId" value={productId} />
        <MultiPicker
          name="relatedIds"
          label="Shown as “You may also like”"
          options={options}
          defaultSelected={defaultSelected}
          max={12}
          emptyHint="Nothing linked — related products fall back to the same category."
        />
      </div>
      <div className="card-footer">
        <SubmitButton pending={pending} className="btn-secondary">Save related products</SubmitButton>
      </div>
    </form>
  );
}
