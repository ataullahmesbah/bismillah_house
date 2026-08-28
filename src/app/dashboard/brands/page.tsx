import Link from "next/link";
import { Field, PageHeader } from "@/components/ui";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { archiveBrandAction, saveBrandAction } from "@/app/actions/dashboard/catalog";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BrandsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.BRAND_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const [brands, settings] = await Promise.all([
    prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, logoUrl: true, description: true,
        seoTitle: true, seoDescription: true, position: true, isActive: true,
        _count: { select: { products: true } },
      },
    }),
    getSettings(),
  ]);

  const editing = editId ? brands.find((brand) => brand.id === editId) ?? null : null;

  return (
    <>
      <PageHeader title="Brands" description="Optional brand records used for filtering and product pages." />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header"><h2 className="card-title">All brands ({brands.length})</h2></div>
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr><th>Brand</th><th className="text-right">Products</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {brands.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-brand-500">No brands yet.</td></tr>
                ) : (
                  brands.map((brand) => (
                    <tr key={brand.id}>
                      <td>
                        <p className="font-semibold">{brand.name}</p>
                        <p className="mono text-xs text-brand-400">/{brand.slug}</p>
                      </td>
                      <td className="td-num">{brand._count.products}</td>
                      <td><span className={brand.isActive ? "badge-green" : "badge-gray"}>{brand.isActive ? "Active" : "Hidden"}</span></td>
                      <td className="td-actions">
                        <div className="inline-flex gap-1.5">
                          <Link href={`/dashboard/brands?edit=${brand.id}`} className="btn-secondary btn-xs">Edit</Link>
                          <QuickActionForm
                            action={archiveBrandAction}
                            values={{ id: brand.id }}
                            label="Archive"
                            className="btn-danger-soft btn-xs"
                            confirm={`Archive “${brand.name}”?`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ActionForm action={saveBrandAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit brand" : "New brand"}</h2>
            {editing ? <Link href="/dashboard/brands" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="Name" htmlFor="name" required errorFor="name">
              <input id="name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={120} />
            </Field>
            <Field label="Slug" htmlFor="slug" errorFor="slug" hint="Leave blank to generate.">
              <input id="slug" name="slug" className="input" defaultValue={editing?.slug ?? ""} maxLength={140} />
            </Field>
            <ImageUploadField
              name="logoUrl"
              label="Logo"
              defaultValue={editing?.logoUrl ?? ""}
              folder="brands"
              recommendation="400 × 200 px, transparent PNG"
              maxSizeMb={settings.upload.maxFileSizeMb}
            />
            <Field label="Description" htmlFor="description">
              <textarea id="description" name="description" className="textarea min-h-20" defaultValue={editing?.description ?? ""} maxLength={2000} />
            </Field>
            <div className="grid-form-2">
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? 0} />
              </Field>
              <Field label="SEO title" htmlFor="seoTitle">
                <input id="seoTitle" name="seoTitle" className="input" defaultValue={editing?.seoTitle ?? ""} maxLength={200} />
              </Field>
            </div>
            <Field label="SEO description" htmlFor="seoDescription">
              <textarea id="seoDescription" name="seoDescription" className="textarea min-h-16" defaultValue={editing?.seoDescription ?? ""} maxLength={400} />
            </Field>
            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
              <span>Active</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save brand" : "Create brand"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
