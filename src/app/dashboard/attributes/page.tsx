import Link from "next/link";
import { Field, PageHeader } from "@/components/ui";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { deleteAttributeOptionAction, saveAttributeAction } from "@/app/actions/dashboard/catalog";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AttributesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.ATTRIBUTE_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const attributes = await prisma.attribute.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, slug: true, type: true, unit: true, position: true, isActive: true,
      options: {
        orderBy: { position: "asc" },
        select: {
          id: true, label: true, value: true, colorHex: true,
          _count: { select: { variantOptions: true } },
        },
      },
      _count: { select: { products: true } },
    },
  });

  const editing = editId ? attributes.find((attribute) => attribute.id === editId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Attributes & variants"
        description="Reusable variant dimensions — Size, Colour, Weight, Volume, Pack, Shoe Size or anything your catalogue needs."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="stack">
          {attributes.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No attributes yet</p>
              <p className="empty-desc">
                Create one on the right — for example “Weight” with the options 500g, 1kg and 2kg.
              </p>
            </div>
          ) : (
            attributes.map((attribute) => (
              <section key={attribute.id} className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">
                      {attribute.name}
                      {attribute.unit ? <span className="ml-1 font-normal text-brand-500">({attribute.unit})</span> : null}
                    </h2>
                    <p className="muted-xs">
                      {attribute.type} · used by {attribute._count.products} product(s) · {attribute.options.length} options
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={attribute.isActive ? "badge-green" : "badge-gray"}>
                      {attribute.isActive ? "Active" : "Hidden"}
                    </span>
                    <Link href={`/dashboard/attributes?edit=${attribute.id}`} className="btn-secondary btn-xs">Edit</Link>
                  </div>
                </div>
                <div className="card-body">
                  {attribute.options.length === 0 ? (
                    <p className="muted">No options yet — edit this attribute and add some.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {attribute.options.map((option) => (
                        <span key={option.id} className="chip">
                          {option.colorHex ? (
                            <span className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: option.colorHex }} aria-hidden="true" />
                          ) : null}
                          {option.label}
                          {option._count.variantOptions > 0 ? (
                            <span className="text-brand-400">· {option._count.variantOptions}</span>
                          ) : (
                            <QuickActionForm
                              action={deleteAttributeOptionAction}
                              values={{ optionId: option.id }}
                              label="×"
                              className="text-brand-400 hover:text-danger-600"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))
          )}
        </div>

        <ActionForm action={saveAttributeAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? `Edit ${editing.name}` : "New attribute"}</h2>
            {editing ? <Link href="/dashboard/attributes" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <Field label="Attribute name" htmlFor="name" required errorFor="name" hint="Size, Colour, Weight, Volume, Shoe Size…">
              <input id="name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={60} />
            </Field>
            <div className="grid-form-2">
              <Field label="Type" htmlFor="type">
                <select id="type" name="type" className="select" defaultValue={editing?.type ?? "SELECT"}>
                  <option value="SELECT">Select (list of values)</option>
                  <option value="COLOR">Colour swatch</option>
                  <option value="TEXT">Free text</option>
                </select>
              </Field>
              <Field label="Unit" htmlFor="unit" hint="g, kg, ml, L…">
                <input id="unit" name="unit" className="input" defaultValue={editing?.unit ?? ""} maxLength={20} />
              </Field>
            </div>
            <Field label="Slug" htmlFor="slug" errorFor="slug" hint="Leave blank to generate.">
              <input id="slug" name="slug" className="input" defaultValue={editing?.slug ?? ""} maxLength={140} />
            </Field>
            <Field
              label="Add options"
              htmlFor="options"
              hint="One per line or comma separated. Existing options are kept."
            >
              <textarea
                id="options"
                name="options"
                className="textarea min-h-28 font-mono text-xs"
                placeholder={"500g\n1kg\n2kg"}
                maxLength={4000}
              />
            </Field>
            <div className="grid-form-2">
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? 0} />
              </Field>
              <label className="check-row self-end">
                <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
                <span>Active</span>
              </label>
            </div>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save attribute" : "Create attribute"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
