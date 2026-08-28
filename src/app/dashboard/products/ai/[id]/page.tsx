import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { Field, PageHeader, StatusPill } from "@/components/ui";
import { applyProductDraftAction, discardProductDraftAction } from "@/app/actions/dashboard/ai";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { DraftPayload } from "@/lib/ai/product-draft";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The review screen.
 *
 * Everything the AI produced is editable before it becomes a product, and the
 * model's own uncertainty is shown at the top rather than buried — the whole
 * point is that a person checks the facts the model could not know.
 */
export default async function AiDraftPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage(PERMISSIONS.AI_USE);
  const { id } = await params;

  const [draft, categories, brands] = await Promise.all([
    prisma.aiProductDraft.findUnique({
      where: { id },
      select: {
        id: true, prompt: true, status: true, provider: true, model: true, payload: true,
        errorMessage: true, productId: true, createdAt: true,
        actor: { select: { name: true } },
      },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!draft) notFound();
  const payload = draft.payload as unknown as DraftPayload | null;

  // A suggestion only counts if it matches something we actually have.
  const suggestedCategory = payload
    ? categories.find((category) => category.name.toLowerCase() === payload.categorySuggestion.toLowerCase())
    : undefined;
  const suggestedBrand = payload
    ? brands.find((brand) => brand.name.toLowerCase() === payload.brandSuggestion.toLowerCase())
    : undefined;

  return (
    <>
      <PageHeader
        title="Review AI draft"
        description={draft.prompt}
        action={<Link href="/dashboard/products/ai" className="btn-secondary">Back to drafts</Link>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill status={draft.status} />
        <span className="muted-xs">
          {draft.provider ?? "—"} {draft.model ? `· ${draft.model}` : ""} · {formatDateTime(draft.createdAt)}
          {draft.actor?.name ? ` · ${draft.actor.name}` : ""}
        </span>
      </div>

      {draft.productId ? (
        <div className="alert-success mb-4" role="status">
          <div>
            This draft has already been turned into a product.{" "}
            <Link href={`/dashboard/products/${draft.productId}`} className="link">Open it</Link>.
          </div>
        </div>
      ) : null}

      {!payload ? (
        <div className="card"><div className="card-body">
          <p className="muted">{draft.errorMessage ?? "This draft has no content."}</p>
        </div></div>
      ) : (
        <>
          {payload.reviewNotes ? (
            <div className="alert-warning mb-4" role="status">
              <div>
                <strong>What the AI was unsure about:</strong>
                <p className="mt-1">{payload.reviewNotes}</p>
              </div>
            </div>
          ) : null}

          <ActionForm action={applyProductDraftAction} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <input type="hidden" name="draftId" value={draft.id} />

            <div className="stack">
              <section className="card">
                <div className="card-header"><h2 className="card-title">Listing</h2></div>
                <div className="card-body stack">
                  <Field label="Name" htmlFor="ai-name" required>
                    <input id="ai-name" name="name" className="input" defaultValue={payload.name} required maxLength={200} />
                  </Field>

                  <Field label="Short description" htmlFor="ai-short">
                    <input
                      id="ai-short"
                      name="shortDescription"
                      className="input"
                      defaultValue={payload.shortDescription}
                      maxLength={500}
                    />
                  </Field>

                  <Field label="Full description" htmlFor="ai-description">
                    <textarea
                      id="ai-description"
                      name="description"
                      rows={10}
                      className="textarea"
                      defaultValue={payload.description}
                    />
                  </Field>
                </div>
              </section>

              {payload.specifications.length > 0 ? (
                <section className="card">
                  <div className="card-header"><h2 className="card-title">Specifications</h2></div>
                  <div className="table-wrap border-0">
                    <table className="table table-compact">
                      <tbody>
                        {payload.specifications.map((spec) => (
                          <tr key={spec.label}>
                            <th className="w-1/3 px-4 py-2 text-left text-xs font-semibold">{spec.label}</th>
                            <td>{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="card-body border-t border-line">
                    <p className="muted-xs">
                      Carried over as-is when the product is created. Check anything you cannot confirm — a wrong
                      specification is a returned parcel.
                    </p>
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="stack">
              <section className="card">
                <div className="card-header"><h2 className="card-title">Classification</h2></div>
                <div className="card-body stack">
                  <Field label="Price (৳)" htmlFor="ai-price" required hint={
                    payload.suggestedPrice
                      ? "Suggested by the AI — check it against your own costs."
                      : "The AI declined to guess a price. Set your own."
                  }>
                    <input
                      id="ai-price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      defaultValue={payload.suggestedPrice ?? ""}
                      required
                    />
                  </Field>

                  <Field
                    label="Category"
                    htmlFor="ai-category"
                    hint={suggestedCategory ? undefined : `AI suggested "${payload.categorySuggestion}" — no match here.`}
                  >
                    <select id="ai-category" name="categoryId" className="select" defaultValue={suggestedCategory?.id ?? ""}>
                      <option value="">Uncategorised</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Brand"
                    htmlFor="ai-brand"
                    hint={suggestedBrand ? undefined : `AI suggested "${payload.brandSuggestion}" — no match here.`}
                  >
                    <select id="ai-brand" name="brandId" className="select" defaultValue={suggestedBrand?.id ?? ""}>
                      <option value="">No brand</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>

              <section className="card">
                <div className="card-header"><h2 className="card-title">SEO &amp; tags</h2></div>
                <div className="card-body space-y-2 text-sm">
                  <p><span className="muted-xs block">Title</span>{payload.seoTitle || "—"}</p>
                  <p><span className="muted-xs block">Description</span>{payload.seoDescription || "—"}</p>
                  <p>
                    <span className="muted-xs block">Keywords</span>
                    {payload.seoKeywords.length > 0 ? payload.seoKeywords.join(", ") : "—"}
                  </p>
                  <p>
                    <span className="muted-xs block">Tags</span>
                    {payload.tags.length > 0 ? payload.tags.join(", ") : "—"}
                  </p>
                  <p><span className="muted-xs block">SKU</span><span className="mono">{payload.sku}</span></p>
                </div>
              </section>

              {payload.variantSuggestions.length > 0 || payload.attributes.length > 0 ? (
                <section className="card">
                  <div className="card-header"><h2 className="card-title">Suggested variants</h2></div>
                  <div className="card-body space-y-2 text-sm">
                    {payload.attributes.map((attribute) => (
                      <p key={attribute.name}>
                        <span className="muted-xs block">{attribute.name}</span>
                        {attribute.values.join(", ")}
                      </p>
                    ))}
                    {payload.variantSuggestions.length > 0 ? (
                      <p>
                        <span className="muted-xs block">Combinations</span>
                        {payload.variantSuggestions.join(" · ")}
                      </p>
                    ) : null}
                    <p className="form-hint">
                      Not created automatically — add them on the product&apos;s variants screen once you have
                      confirmed prices and stock for each.
                    </p>
                  </div>
                </section>
              ) : null}

              {payload.imagePrompt ? (
                <section className="card">
                  <div className="card-header"><h2 className="card-title">Image prompt</h2></div>
                  <div className="card-body">
                    <p className="text-sm">{payload.imagePrompt}</p>
                    <p className="form-hint mt-2">
                      Paste this into an image generator, or shoot the real product. Images are added on the product
                      screen after this draft becomes a product.
                    </p>
                  </div>
                </section>
              ) : null}

              {!draft.productId ? (
                <section className="card">
                  <div className="card-body space-y-2">
                    <SubmitButton className="btn-primary btn-block">Create as draft product</SubmitButton>
                    <p className="form-hint">
                      The product is created unpublished. Add images and stock, then publish it yourself — the AI
                      never puts anything live.
                    </p>
                    <QuickActionForm
                      action={discardProductDraftAction}
                      values={{ draftId: draft.id }}
                      label="Discard this draft"
                      className="btn-ghost btn-sm btn-block"
                      confirm="Discard this draft?"
                    />
                  </div>
                </section>
              ) : null}
            </aside>
          </ActionForm>
        </>
      )}
    </>
  );
}
