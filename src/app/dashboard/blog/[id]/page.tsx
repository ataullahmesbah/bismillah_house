import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { addBlogImageAction, deleteBlogImageAction } from "@/app/actions/dashboard/blog";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

import { BlogTabs } from "../nav";
import { BlogPostForm } from "../post-form";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermissionPage(PERMISSIONS.BLOG_WRITE);
  const { id } = await params;

  const [post, categories, mayPublish, mayEditAll, mayDelete] = await Promise.all([
    prisma.blogPost.findUnique({
      where: { id },
      select: {
        id: true, slug: true, title: true, subtitle: true, excerpt: true, content: true,
        coverImageUrl: true, coverImageAlt: true, categoryId: true, tags: true,
        status: true, publishedAt: true, isFeatured: true, viewCount: true,
        readingMinutes: true, authorId: true, authorName: true, updatedAt: true,
        seoTitle: true, seoDescription: true, ogImageUrl: true, canonicalUrl: true, noIndex: true,
        images: { select: { id: true, url: true, alt: true, caption: true }, orderBy: { position: "asc" } },
      },
    }),
    prisma.blogCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    userHasPermission(user, PERMISSIONS.BLOG_PUBLISH),
    userHasPermission(user, PERMISSIONS.BLOG_MANAGE_ALL),
    userHasPermission(user, PERMISSIONS.BLOG_DELETE),
  ]);

  if (!post) notFound();

  /**
   * The same ownership rule the save action applies, checked before anything is
   * rendered. Without it a writer could open someone else's article, fill the
   * form, and only discover on submit that they were never allowed to.
   */
  if (post.authorId !== user.id && !mayEditAll) notFound();

  return (
    <>
      <PageHeader
        title={post.title}
        description={`${post.readingMinutes} min read · ${post.viewCount} views · last saved ${formatDateTime(post.updatedAt)}${post.authorName ? ` · by ${post.authorName}` : ""}`}
        action={<Link href="/dashboard/blog" className="btn-secondary btn-sm">All articles</Link>}
      />
      <BlogTabs active="/dashboard/blog" />

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem] xl:items-start">
        <div className="min-w-0">
          <BlogPostForm post={post} categories={categories} mayPublish={mayPublish} mayDelete={mayDelete} />
        </div>

        <section className="card xl:sticky xl:top-4">
          <div className="card-header">
            <h2 className="card-title">Images ({post.images.length})</h2>
          </div>

          <div className="card-body stack">
            <p className="muted-xs">
              Extra pictures for this article. They appear in a gallery under the body, and you can drop any of
              them into the content with an <code className="mono">&lt;img src=&quot;…&quot;&gt;</code> tag.
            </p>

            {post.images.length === 0 ? (
              <EmptyState title="No extra images" description="The cover image is set on the left." />
            ) : (
              <ul className="stack">
                {post.images.map((image) => (
                  <li key={image.id} className="flex items-start gap-3 rounded-[var(--radius-tm)] border border-line p-2">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded bg-surface-sunken">
                      <Image src={image.url} alt={image.alt ?? ""} fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="clamp-2 text-xs font-medium">{image.alt || "No description"}</p>
                      {image.caption ? <p className="muted-xs clamp-2">{image.caption}</p> : null}
                      <p className="mono muted-xs mt-1 break-all">{image.url}</p>
                    </div>
                    <QuickActionForm
                      action={deleteBlogImageAction}
                      values={{ id: image.id }}
                      label="Remove"
                      className="btn-danger-soft btn-xs shrink-0"
                      confirm="Remove this image from the article?"
                    />
                  </li>
                ))}
              </ul>
            )}

            <ActionForm action={addBlogImageAction} successRedirect={false} className="stack border-t border-line pt-3">
              <input type="hidden" name="postId" value={post.id} />
              <ImageUploadField name="url" label="Add an image" folder="blog" recommendation="1200 px wide" />
              <Field label="Description" htmlFor="alt" hint="What it shows. Read aloud by screen readers.">
                <input id="alt" name="alt" className="input" maxLength={200} />
              </Field>
              <Field label="Caption" htmlFor="caption" hint="Optional line printed under the picture.">
                <input id="caption" name="caption" className="input" maxLength={300} />
              </Field>
              <SubmitButton className="btn-secondary w-full">Add image</SubmitButton>
            </ActionForm>
          </div>
        </section>
      </div>
    </>
  );
}
