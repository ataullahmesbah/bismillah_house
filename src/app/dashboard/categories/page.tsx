import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { Field } from "@/components/ui";
import { archiveCategoryAction, saveCategoryAction } from "@/app/actions/dashboard/catalog";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.CATEGORY_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const [categories, settings] = await Promise.all([
    prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, parentId: true, position: true, isActive: true,
        showInMenu: true, isFeatured: true, imageUrl: true,
        parent: { select: { name: true } },
        _count: { select: { products: true, children: true } },
      },
    }),
    getSettings(),
  ]);

  const editing = editId ? categories.find((category) => category.id === editId) ?? null : null;
  const full = editing
    ? await prisma.category.findUnique({
        where: { id: editing.id },
        select: {
          id: true, name: true, slug: true, parentId: true, description: true, imageUrl: true,
          bannerUrl: true, iconName: true, seoTitle: true, seoDescription: true,
          position: true, isActive: true, showInMenu: true, isFeatured: true,
        },
      })
    : null;

  return (
    <>
      <PageHeader title="Categories" description="Categories and subcategories shown across the shop and menus." />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header"><h2 className="card-title">All categories ({categories.length})</h2></div>
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Parent</th><th className="text-right">Products</th><th>Visibility</th><th /></tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-brand-500">No categories yet — add the first one.</td></tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <p className="font-semibold">{category.name}</p>
                        <p className="mono text-xs text-brand-400">/{category.slug}</p>
                      </td>
                      <td className="text-xs">{category.parent?.name ?? "—"}</td>
                      <td className="td-num">{category._count.products}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <span className={category.isActive ? "badge-green" : "badge-gray"}>
                            {category.isActive ? "Active" : "Hidden"}
                          </span>
                          {category.showInMenu ? <span className="badge-outline">Menu</span> : null}
                          {category.isFeatured ? <span className="badge-accent">Featured</span> : null}
                        </div>
                      </td>
                      <td className="td-actions">
                        <div className="inline-flex gap-1.5">
                          <Link href={`/dashboard/categories?edit=${category.id}`} className="btn-secondary btn-xs">Edit</Link>
                          <QuickActionForm
                            action={archiveCategoryAction}
                            values={{ id: category.id }}
                            label="Archive"
                            className="btn-danger-soft btn-xs"
                            confirm={`Archive “${category.name}”? Its ${category._count.products} product(s) stay in the catalogue.`}
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

        <ActionForm action={saveCategoryAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{full ? "Edit category" : "New category"}</h2>
            {full ? <Link href="/dashboard/categories" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={full?.id ?? ""} />

            <Field label="Name" htmlFor="name" required errorFor="name">
              <input id="name" name="name" className="input" defaultValue={full?.name ?? ""} required maxLength={120} />
            </Field>
            <Field label="Slug" htmlFor="slug" errorFor="slug" hint="Leave blank to generate.">
              <input id="slug" name="slug" className="input" defaultValue={full?.slug ?? ""} maxLength={140} />
            </Field>
            <Field label="Parent category" htmlFor="parentId" errorFor="parentId">
              <select id="parentId" name="parentId" className="select" defaultValue={full?.parentId ?? ""}>
                <option value="">Top level</option>
                {categories
                  .filter((category) => category.id !== full?.id && !category.parentId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
              </select>
            </Field>
            <Field label="Description" htmlFor="description" errorFor="description">
              <textarea id="description" name="description" className="textarea min-h-20" defaultValue={full?.description ?? ""} maxLength={2000} />
            </Field>

            <ImageUploadField
              name="imageUrl"
              label="Category image"
              defaultValue={full?.imageUrl ?? ""}
              folder="categories"
              recommendation={settings.upload.recommendedCategoryImage}
              maxSizeMb={settings.upload.maxFileSizeMb}
            />
            <ImageUploadField
              name="bannerUrl"
              label="Category banner"
              defaultValue={full?.bannerUrl ?? ""}
              folder="categories"
              recommendation={settings.upload.recommendedBanner}
              maxSizeMb={settings.upload.maxFileSizeMb}
            />

            <div className="grid-form-2">
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={full?.position ?? 0} />
              </Field>
              <Field label="Icon name" htmlFor="iconName" hint="Optional label for your own reference.">
                <input id="iconName" name="iconName" className="input" defaultValue={full?.iconName ?? ""} maxLength={60} />
              </Field>
            </div>

            <Field label="SEO title" htmlFor="seoTitle">
              <input id="seoTitle" name="seoTitle" className="input" defaultValue={full?.seoTitle ?? ""} maxLength={200} />
            </Field>
            <Field label="SEO description" htmlFor="seoDescription">
              <textarea id="seoDescription" name="seoDescription" className="textarea min-h-16" defaultValue={full?.seoDescription ?? ""} maxLength={400} />
            </Field>

            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={full?.isActive ?? true} />
              <span>Active</span>
            </label>
            <label className="check-row">
              <input type="checkbox" name="showInMenu" className="checkbox mt-0.5" defaultChecked={full?.showInMenu ?? true} />
              <span>Show in navigation menus</span>
            </label>
            <label className="check-row">
              <input type="checkbox" name="isFeatured" className="checkbox mt-0.5" defaultChecked={full?.isFeatured ?? false} />
              <span>Feature on the homepage</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>{full ? "Save category" : "Create category"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
