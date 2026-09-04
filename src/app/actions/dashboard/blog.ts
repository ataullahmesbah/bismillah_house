"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import {
  booleanSchema,
  formDataToObject,
  optionalDateTimeSchema,
  optionalIdSchema,
  optionalText,
  optionalUrlSchema,
  requiredText,
  slugSchema,
} from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requireAnyPermission, requirePermission } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { readingMinutes, sanitizeRichText } from "@/lib/sanitize";
import type { SessionUser } from "@/lib/auth/session";

/** Blog CMS: articles, their images, and the categories they sit in. */

/* ------------------------------- Articles --------------------------------- */

const postSchema = z.object({
  slug: slugSchema,
  title: requiredText("Title", 200),
  subtitle: optionalText(300),
  excerpt: optionalText(500),
  content: requiredText("Content", 200_000),
  coverImageUrl: optionalUrlSchema,
  coverImageAlt: optionalText(200),
  categoryId: optionalIdSchema,
  /** Comma-separated in the form; split and de-duplicated here. */
  tags: optionalText(500),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  publishedAt: optionalDateTimeSchema,
  isFeatured: booleanSchema.default(false),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  ogImageUrl: optionalUrlSchema,
  canonicalUrl: optionalUrlSchema,
  noIndex: booleanSchema.default(false),
});

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const tag of raw.split(",")) {
    const clean = tag.trim().replace(/\s+/g, " ").slice(0, 40);
    // Case-insensitive de-dupe, so "Recipes" and "recipes" do not both become
    // filter chips that each show half the articles.
    if (clean && !seen.has(clean.toLowerCase())) seen.add(clean.toLowerCase());
  }
  return [...seen].slice(0, 12);
}

/**
 * Who may touch this article.
 *
 * A writer holding only `blog.write` owns their own drafts and nothing else.
 * `blog.manage_all` lifts that. This is re-derived from the database on every
 * write — the editor hiding a button is a convenience, not the check.
 */
async function assertMayEditPost(user: SessionUser, postId: string | null) {
  if (!postId) return;
  const existing = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!existing) throw errors.notFound("That article no longer exists.");
  if (existing.authorId === user.id) return;
  if (await userHasPermission(user, PERMISSIONS.BLOG_MANAGE_ALL)) return;
  throw errors.forbidden("You can only edit articles you wrote.");
}

export async function saveBlogPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BLOG_WRITE);
    const id = String(formData.get("id") ?? "") || null;
    await assertMayEditPost(user, id);

    const input = postSchema.parse(formDataToObject(formData));
    const slug = slugify(input.slug);

    const clash = await prisma.blogPost.findFirst({
      where: { slug, NOT: id ? { id } : undefined },
      select: { id: true },
    });
    if (clash) throw errors.validation("That article URL is already used.", { slug: "Slug already in use." });

    // Publishing is a separate permission. A writer who selects PUBLISHED
    // without it gets their work saved for review rather than an error — the
    // article is not lost, it just does not go live.
    const mayPublish = await userHasPermission(user, PERMISSIONS.BLOG_PUBLISH);
    const requested = input.status;
    const status = requested === "PUBLISHED" && !mayPublish ? "IN_REVIEW" : requested;

    // The body is sanitised before it is stored, so nothing downstream — the
    // article page, the RSS feed, the dashboard preview — has to trust it.
    const content = sanitizeRichText(input.content);

    const data = {
      slug,
      title: input.title,
      subtitle: input.subtitle,
      excerpt: input.excerpt,
      content,
      coverImageUrl: input.coverImageUrl,
      coverImageAlt: input.coverImageAlt,
      categoryId: input.categoryId,
      tags: parseTags(input.tags),
      status,
      // A publish date the editor set wins; otherwise going live stamps now.
      // Un-publishing does not clear it, so re-publishing keeps the original.
      publishedAt:
        input.publishedAt ?? (status === "PUBLISHED" ? new Date() : undefined),
      isFeatured: input.isFeatured,
      readingMinutes: readingMinutes(content),
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      ogImageUrl: input.ogImageUrl,
      canonicalUrl: input.canonicalUrl,
      noIndex: input.noIndex,
    };

    const post = id
      ? await prisma.blogPost.update({ where: { id }, data })
      : await prisma.blogPost.create({
          data: { ...data, authorId: user.id, authorName: user.name },
        });

    await recordAudit({
      actor: user,
      action: status === "PUBLISHED" ? AUDIT_ACTIONS.BLOG_POST_PUBLISHED : AUDIT_ACTIONS.BLOG_POST_SAVED,
      entityType: "blog_post",
      entityId: post.id,
      summary: `${id ? "Updated" : "Created"} article “${post.title}” (${status.toLowerCase()})`,
    });

    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/dashboard/blog");

    const message =
      requested === "PUBLISHED" && !mayPublish
        ? "Saved and sent for review — publishing needs an editor."
        : id
          ? "Article updated."
          : "Article created.";
    // The article editor is its own route. `?edit=` is the categories page's
    // pattern, and sending an author there after saving drops them on the list
    // with their article nowhere in sight.
    return actionSuccess(message, `/dashboard/blog/${post.id}`);
  } catch (error) {
    return actionFailure(error, "saveBlogPost");
  }
}

export async function deleteBlogPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BLOG_DELETE);
    const id = String(formData.get("id") ?? "");
    const post = await prisma.blogPost.delete({ where: { id }, select: { slug: true, title: true } });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.BLOG_POST_DELETED,
      entityType: "blog_post",
      entityId: id,
      summary: `Deleted article “${post.title}”`,
      severity: "WARNING",
    });

    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/dashboard/blog");
    return actionSuccess("Article deleted.", "/dashboard/blog");
  } catch (error) {
    return actionFailure(error, "deleteBlogPost");
  }
}

/** One-click publish / unpublish from the article list. */
export async function toggleBlogPostStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BLOG_PUBLISH);
    const id = String(formData.get("id") ?? "");
    const current = await prisma.blogPost.findUnique({
      where: { id },
      select: { status: true, title: true, slug: true, publishedAt: true },
    });
    if (!current) throw errors.notFound("That article no longer exists.");

    const live = current.status === "PUBLISHED";
    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        status: live ? "DRAFT" : "PUBLISHED",
        publishedAt: live ? current.publishedAt : (current.publishedAt ?? new Date()),
      },
      select: { slug: true, status: true },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.BLOG_POST_PUBLISHED,
      entityType: "blog_post",
      entityId: id,
      summary: `${live ? "Unpublished" : "Published"} article “${current.title}”`,
    });

    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/dashboard/blog");
    return actionSuccess(live ? "Article unpublished." : "Article published.");
  } catch (error) {
    return actionFailure(error, "toggleBlogPostStatus");
  }
}

/* -------------------------------- Images ---------------------------------- */

const imageSchema = z.object({
  postId: z.string().min(1),
  url: requiredText("Image", 800),
  alt: optionalText(200),
  caption: optionalText(300),
});

export async function addBlogImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BLOG_WRITE);
    const input = imageSchema.parse(formDataToObject(formData));
    // The image belongs to an article, so the article's ownership rule decides
    // who may attach one.
    await assertMayEditPost(user, input.postId);

    const last = await prisma.blogImage.findFirst({
      where: { postId: input.postId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.blogImage.create({
      data: {
        postId: input.postId,
        url: input.url,
        alt: input.alt,
        caption: input.caption,
        position: (last?.position ?? -1) + 1,
      },
    });

    revalidatePath("/dashboard/blog");
    return actionSuccess("Image added.");
  } catch (error) {
    return actionFailure(error, "addBlogImage");
  }
}

export async function deleteBlogImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.BLOG_WRITE);
    const id = String(formData.get("id") ?? "");
    const image = await prisma.blogImage.findUnique({ where: { id }, select: { postId: true } });
    if (!image) throw errors.notFound("That image no longer exists.");
    await assertMayEditPost(user, image.postId);

    await prisma.blogImage.delete({ where: { id } });
    revalidatePath("/dashboard/blog");
    return actionSuccess("Image removed.");
  } catch (error) {
    return actionFailure(error, "deleteBlogImage");
  }
}

/* ------------------------------ Categories -------------------------------- */

const categorySchema = z.object({
  slug: slugSchema,
  name: requiredText("Name", 120),
  description: optionalText(400),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isActive: booleanSchema.default(true),
});

export async function saveBlogCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireAnyPermission([PERMISSIONS.BLOG_PUBLISH, PERMISSIONS.BLOG_MANAGE_ALL]);
    const id = String(formData.get("id") ?? "");
    const input = categorySchema.parse(formDataToObject(formData));
    const slug = slugify(input.slug);

    const clash = await prisma.blogCategory.findFirst({
      where: { slug, NOT: id ? { id } : undefined },
      select: { id: true },
    });
    if (clash) throw errors.validation("That category URL is already used.", { slug: "Slug already in use." });

    const data = { ...input, slug };
    const category = id
      ? await prisma.blogCategory.update({ where: { id }, data })
      : await prisma.blogCategory.create({ data });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.BLOG_POST_SAVED,
      entityType: "blog_category",
      entityId: category.id,
      summary: `${id ? "Updated" : "Created"} blog category “${category.name}”`,
    });

    revalidatePath("/blog");
    revalidatePath("/dashboard/blog/categories");
    return actionSuccess(id ? "Category updated." : "Category created.");
  } catch (error) {
    return actionFailure(error, "saveBlogCategory");
  }
}

export async function deleteBlogCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireAnyPermission([PERMISSIONS.BLOG_DELETE, PERMISSIONS.BLOG_MANAGE_ALL]);
    const id = String(formData.get("id") ?? "");
    // Articles survive: the relation is SetNull, so deleting a category
    // un-files its articles rather than taking them down with it.
    const category = await prisma.blogCategory.delete({ where: { id }, select: { name: true } });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.BLOG_POST_DELETED,
      entityType: "blog_category",
      entityId: id,
      summary: `Deleted blog category “${category.name}”`,
      severity: "WARNING",
    });

    revalidatePath("/blog");
    revalidatePath("/dashboard/blog/categories");
    return actionSuccess("Category deleted.");
  } catch (error) {
    return actionFailure(error, "deleteBlogCategory");
  }
}
