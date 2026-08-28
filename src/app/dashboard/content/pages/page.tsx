import Link from "next/link";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { deletePageAction, savePageAction } from "@/app/actions/dashboard/content";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContentPagesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.CONTENT_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const pages = await prisma.page.findMany({
    orderBy: [{ type: "asc" }, { position: "asc" }],
    select: {
      id: true, slug: true, title: true, excerpt: true, content: true, type: true,
      seoTitle: true, seoDescription: true, noIndex: true, isPublished: true,
      position: true, updatedAt: true,
    },
  });

  const editing = editId ? pages.find((page) => page.id === editId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Pages & policies"
        description="Terms, privacy, shipping, returns, refunds and any other content page — all editable here."
      />

      <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
        <section className="card xl:order-1">
          <div className="card-header">
            <h2 className="card-title">Pages ({pages.length})</h2>
            <Link href="/dashboard/content/pages" className="btn-secondary btn-xs">New page</Link>
          </div>
          <div className="card-body p-2">
            {pages.length === 0 ? (
              <EmptyState title="No pages yet" description="Create your policy pages to publish them." />
            ) : (
              pages.map((page) => (
                <Link
                  key={page.id}
                  href={`/dashboard/content/pages?edit=${page.id}`}
                  className={`sidebar-link justify-between ${editing?.id === page.id ? "sidebar-link-active" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{page.title}</span>
                    <span className="block truncate text-xs opacity-70">/{page.slug} · {formatDate(page.updatedAt)}</span>
                  </span>
                  {!page.isPublished ? <span className="badge-gray shrink-0">Draft</span> : null}
                </Link>
              ))
            )}
          </div>
        </section>

        <ActionForm action={savePageAction} className="card xl:order-2">
          <div className="card-header">
            <h2 className="card-title">{editing ? `Edit “${editing.title}”` : "New page"}</h2>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Link href={`/${editing.slug}`} className="btn-ghost btn-xs" target="_blank" rel="noopener noreferrer">
                    View
                  </Link>
                  <QuickActionForm
                    action={deletePageAction}
                    values={{ id: editing.id }}
                    label="Delete"
                    className="btn-danger-soft btn-xs"
                    confirm={`Delete “${editing.title}” permanently?`}
                  />
                </>
              ) : null}
            </div>
          </div>

          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <div className="grid-form-2">
              <Field label="Title" htmlFor="title" required errorFor="title">
                <input id="title" name="title" className="input" defaultValue={editing?.title ?? ""} required maxLength={200} />
              </Field>
              <Field label="URL slug" htmlFor="slug" required errorFor="slug" hint="e.g. privacy → /privacy">
                <input id="slug" name="slug" className="input" defaultValue={editing?.slug ?? ""} required maxLength={140} />
              </Field>
            </div>

            <div className="grid-form-2">
              <Field label="Page type" htmlFor="type">
                <select id="type" name="type" className="select" defaultValue={editing?.type ?? "POLICY"}>
                  <option value="POLICY">Policy</option>
                  <option value="HELP">Help</option>
                  <option value="GENERIC">Generic</option>
                </select>
              </Field>
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? 0} />
              </Field>
            </div>

            <Field label="Summary" htmlFor="excerpt" hint="Short intro shown at the top of the page and in listings.">
              <textarea id="excerpt" name="excerpt" className="textarea min-h-16" defaultValue={editing?.excerpt ?? ""} maxLength={400} />
            </Field>

            <Field
              label="Content"
              htmlFor="content"
              required
              errorFor="content"
              hint="HTML is allowed — use <h2>, <p>, <ul>, <strong> and <a> for structure."
            >
              <textarea
                id="content"
                name="content"
                className="textarea min-h-80 font-mono text-xs"
                defaultValue={editing?.content ?? ""}
                required
                maxLength={100000}
              />
            </Field>

            <div className="grid-form-2">
              <Field label="SEO title" htmlFor="seoTitle">
                <input id="seoTitle" name="seoTitle" className="input" defaultValue={editing?.seoTitle ?? ""} maxLength={200} />
              </Field>
              <Field label="SEO description" htmlFor="seoDescription">
                <input id="seoDescription" name="seoDescription" className="input" defaultValue={editing?.seoDescription ?? ""} maxLength={400} />
              </Field>
            </div>

            <div className="grid-form-2">
              <label className="check-row">
                <input type="checkbox" name="isPublished" className="checkbox mt-0.5" defaultChecked={editing?.isPublished ?? true} />
                <span>Published</span>
              </label>
              <label className="check-row">
                <input type="checkbox" name="noIndex" className="checkbox mt-0.5" defaultChecked={editing?.noIndex ?? false} />
                <span>Hide from search engines</span>
              </label>
            </div>
          </div>

          <div className="card-footer">
            <SubmitButton>{editing ? "Save page" : "Create page"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
