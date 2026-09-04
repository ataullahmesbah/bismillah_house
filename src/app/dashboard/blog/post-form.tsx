import Link from "next/link";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { Field } from "@/components/ui";
import { deleteBlogPostAction, saveBlogPostAction } from "@/app/actions/dashboard/blog";

/**
 * The article editor, shared by the new and edit routes so the two can never
 * drift apart on a field.
 *
 * The image gallery is deliberately NOT part of this form. Images belong to a
 * saved article, and nesting a second form inside this one to add them would
 * be invalid HTML — so the gallery lives beside it on the edit page and posts
 * to its own action.
 */

export type EditablePost = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  categoryId: string | null;
  tags: string[];
  status: string;
  publishedAt: Date | null;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
};

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function BlogPostForm({
  post,
  categories,
  mayPublish,
  mayDelete,
}: {
  post: EditablePost | null;
  categories: Array<{ id: string; name: string }>;
  mayPublish: boolean;
  mayDelete: boolean;
}) {
  return (
    <ActionForm action={saveBlogPostAction} className="stack">
      <input type="hidden" name="id" value={post?.id ?? ""} />

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Article</h2>
          {post ? (
            <div className="flex gap-2">
              <Link href={`/blog/${post.slug}`} className="btn-ghost btn-xs" target="_blank" rel="noopener noreferrer">
                Preview
              </Link>
              {mayDelete ? (
                <QuickActionForm
                  action={deleteBlogPostAction}
                  values={{ id: post.id }}
                  label="Delete"
                  className="btn-danger-soft btn-xs"
                  confirm={`Delete “${post.title}” permanently?`}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="card-body stack">
          <Field label="Title" htmlFor="title" required errorFor="title">
            <input
              id="title"
              name="title"
              className="input"
              defaultValue={post?.title ?? ""}
              required
              maxLength={200}
              placeholder="How to store dates so they stay soft"
            />
          </Field>

          <div className="grid-form-2">
            <Field label="Subtitle" htmlFor="subtitle" errorFor="subtitle" hint="One line under the title on the article page.">
              <input id="subtitle" name="subtitle" className="input" defaultValue={post?.subtitle ?? ""} maxLength={300} />
            </Field>
            <Field label="URL slug" htmlFor="slug" required errorFor="slug" hint="Becomes /blog/your-slug">
              <input id="slug" name="slug" className="input" defaultValue={post?.slug ?? ""} required maxLength={140} />
            </Field>
          </div>

          <Field
            label="Summary"
            htmlFor="excerpt"
            errorFor="excerpt"
            hint="Shown on the blog cards, and used as the meta description when you leave that blank."
          >
            <textarea
              id="excerpt"
              name="excerpt"
              className="textarea min-h-20"
              defaultValue={post?.excerpt ?? ""}
              maxLength={500}
            />
          </Field>

          <Field
            label="Content"
            htmlFor="content"
            required
            errorFor="content"
            hint="HTML is allowed — <h2>, <p>, <ul>, <strong>, <a> and <img>. Anything unsafe is stripped when you save."
          >
            <textarea
              id="content"
              name="content"
              className="textarea min-h-96 font-mono text-xs"
              defaultValue={post?.content ?? ""}
              required
            />
          </Field>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Cover image</h2></div>
        <div className="card-body stack">
          <ImageUploadField
            name="coverImageUrl"
            label="Cover image"
            defaultValue={post?.coverImageUrl ?? ""}
            folder="blog"
            recommendation="1200 × 675 px (16:9)"
          />
          <Field
            label="Cover image description"
            htmlFor="coverImageAlt"
            hint="What the picture shows, for screen readers and for search engines. Leave blank only if it is purely decorative."
          >
            <input
              id="coverImageAlt"
              name="coverImageAlt"
              className="input"
              defaultValue={post?.coverImageAlt ?? ""}
              maxLength={200}
            />
          </Field>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Filing</h2></div>
        <div className="card-body stack">
          <div className="grid-form-2">
            <Field label="Category" htmlFor="categoryId">
              <select id="categoryId" name="categoryId" className="select" defaultValue={post?.categoryId ?? ""}>
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. dates, storage, ramadan">
              <input id="tags" name="tags" className="input" defaultValue={post?.tags.join(", ") ?? ""} maxLength={500} />
            </Field>
          </div>

          <div className="grid-form-2">
            <Field label="Status" htmlFor="status" hint={mayPublish ? undefined : "Publishing needs an editor — choose Published and it is saved for review."}>
              <select id="status" name="status" className="select" defaultValue={post?.status ?? "DRAFT"}>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In review</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
            <Field
              label="Publish date"
              htmlFor="publishedAt"
              hint="Leave blank to go live as soon as you publish. A future date holds it back until then."
            >
              <input
                id="publishedAt"
                name="publishedAt"
                type="datetime-local"
                className="input"
                defaultValue={toLocalInput(post?.publishedAt ?? null)}
              />
            </Field>
          </div>

          <label className="check-row">
            <input type="checkbox" name="isFeatured" value="true" className="checkbox mt-0.5" defaultChecked={post?.isFeatured ?? false} />
            <span>Feature this article at the top of the blog</span>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Search engines</h2>
          <p className="muted-xs">Each of these falls back to the article&rsquo;s own text when left blank.</p>
        </div>
        <div className="card-body stack">
          <div className="grid-form-2">
            <Field label="SEO title" htmlFor="seoTitle" hint="Around 60 characters. Defaults to the article title.">
              <input id="seoTitle" name="seoTitle" className="input" defaultValue={post?.seoTitle ?? ""} maxLength={200} />
            </Field>
            <Field label="Canonical URL" htmlFor="canonicalUrl" hint="Only if this article was first published elsewhere.">
              <input id="canonicalUrl" name="canonicalUrl" type="url" className="input" defaultValue={post?.canonicalUrl ?? ""} />
            </Field>
          </div>

          <Field
            label="Meta description"
            htmlFor="seoDescription"
            hint="Around 155 characters. This is the sentence under the title in search results."
          >
            <textarea
              id="seoDescription"
              name="seoDescription"
              className="textarea min-h-16"
              defaultValue={post?.seoDescription ?? ""}
              maxLength={400}
            />
          </Field>

          <ImageUploadField
            name="ogImageUrl"
            label="Social share image"
            defaultValue={post?.ogImageUrl ?? ""}
            folder="blog"
            recommendation="1200 × 630 px — defaults to the cover image"
          />

          <label className="check-row">
            <input type="checkbox" name="noIndex" value="true" className="checkbox mt-0.5" defaultChecked={post?.noIndex ?? false} />
            <span>Ask search engines not to index this article</span>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/dashboard/blog" className="btn-secondary">Cancel</Link>
        <SubmitButton>{post ? "Save article" : "Create article"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
