import Link from "next/link";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { deleteBlogCategoryAction, saveBlogCategoryAction } from "@/app/actions/dashboard/blog";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";

import { BlogTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BlogCategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAnyPermissionPage([PERMISSIONS.BLOG_PUBLISH, PERMISSIONS.BLOG_MANAGE_ALL]);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const categories = await prisma.blogCategory.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true, slug: true, name: true, description: true, position: true, isActive: true,
      _count: { select: { posts: true } },
    },
  });

  const editing = editId ? categories.find((category) => category.id === editId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Blog categories"
        description="Groups for your articles. Deleting one leaves its articles in place, just uncategorised."
      />
      <BlogTabs active="/dashboard/blog/categories" />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem] xl:items-start">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Categories ({categories.length})</h2>
            <Link href="/dashboard/blog/categories" className="btn-secondary btn-xs">New category</Link>
          </div>
          <div className="card-body p-2">
            {categories.length === 0 ? (
              <EmptyState title="No categories yet" description="Add one to group your articles." />
            ) : (
              categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/dashboard/blog/categories?edit=${category.id}`}
                  className={`sidebar-link justify-between ${editing?.id === category.id ? "sidebar-link-active" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{category.name}</span>
                    <span className="block truncate text-xs opacity-70">
                      /blog?category={category.slug} · {category._count.posts} article
                      {category._count.posts === 1 ? "" : "s"}
                    </span>
                  </span>
                  {!category.isActive ? <span className="badge-gray shrink-0">Hidden</span> : null}
                </Link>
              ))
            )}
          </div>
        </section>

        <ActionForm action={saveBlogCategoryAction} className="card xl:sticky xl:top-4">
          <div className="card-header">
            <h2 className="card-title">{editing ? `Edit “${editing.name}”` : "New category"}</h2>
            {editing ? (
              <QuickActionForm
                action={deleteBlogCategoryAction}
                values={{ id: editing.id }}
                label="Delete"
                className="btn-danger-soft btn-xs"
                confirm={`Delete “${editing.name}”? Its ${editing._count.posts} article${editing._count.posts === 1 ? "" : "s"} will stay, uncategorised.`}
              />
            ) : null}
          </div>

          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <Field label="Name" htmlFor="name" required errorFor="name">
              <input id="name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={120} />
            </Field>

            <Field label="URL slug" htmlFor="slug" required errorFor="slug" hint="e.g. recipes → /blog?category=recipes">
              <input id="slug" name="slug" className="input" defaultValue={editing?.slug ?? ""} required maxLength={140} />
            </Field>

            <Field label="Description" htmlFor="description" hint="Shown at the top of the filtered listing.">
              <textarea
                id="description"
                name="description"
                className="textarea min-h-16"
                defaultValue={editing?.description ?? ""}
                maxLength={400}
              />
            </Field>

            <Field label="Position" htmlFor="position" hint="Lower numbers come first.">
              <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? 0} />
            </Field>

            <label className="check-row">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                className="checkbox mt-0.5"
                defaultChecked={editing?.isActive ?? true}
              />
              <span>Show this category on the blog</span>
            </label>

            <SubmitButton>{editing ? "Save category" : "Create category"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
