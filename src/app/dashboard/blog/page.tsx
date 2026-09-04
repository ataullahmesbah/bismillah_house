import Link from "next/link";

import { QuickActionForm } from "@/components/dashboard/action-form";
import { EmptyState, PageHeader, Pagination, StatusPill } from "@/components/ui";
import { toggleBlogPostStatusAction } from "@/app/actions/dashboard/blog";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { BlogStatus } from "@/generated/prisma/enums";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

import { BlogTabs } from "./nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUSES: BlogStatus[] = ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"];

export default async function BlogListPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAnyPermissionPage([PERMISSIONS.BLOG_VIEW, PERMISSIONS.BLOG_WRITE]);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const rawStatus = single("status") ?? "";
  const status = STATUSES.includes(rawStatus as BlogStatus) ? (rawStatus as BlogStatus) : "";
  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const [mayPublish, mayEditAll] = await Promise.all([
    userHasPermission(user, PERMISSIONS.BLOG_PUBLISH),
    userHasPermission(user, PERMISSIONS.BLOG_MANAGE_ALL),
  ]);

  /**
   * A writer without `blog.manage_all` sees only their own articles. This is
   * the same rule the save action enforces — the list is filtered so the
   * dashboard does not offer an Edit link that would be refused on submit.
   */
  const where: Prisma.BlogPostWhereInput = {
    ...(mayEditAll ? {} : { authorId: user.id }),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [posts, total, counts] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, slug: true, title: true, status: true, publishedAt: true,
        updatedAt: true, viewCount: true, readingMinutes: true, authorName: true,
        isFeatured: true, coverImageUrl: true,
        category: { select: { name: true } },
      },
    }),
    prisma.blogPost.count({ where }),
    prisma.blogPost.groupBy({
      by: ["status"],
      where: mayEditAll ? {} : { authorId: user.id },
      _count: { _all: true },
    }),
  ]);

  const countFor = (value: BlogStatus) => counts.find((row) => row.status === value)?._count._all ?? 0;
  const tabHref = (value: string) => `/dashboard/blog${buildQuery({ q, status: value })}`;

  return (
    <>
      <PageHeader
        title="Blog"
        description="Write articles, give them a picture and a description, and decide when they go live."
        action={<Link href="/dashboard/blog/new" className="btn-primary btn-sm">Write an article</Link>}
      />
      <BlogTabs active="/dashboard/blog" />

      <form className="card mb-4" action="/dashboard/blog">
        <div className="card-body grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <label className="field">
            <span className="label">Search</span>
            <input name="q" defaultValue={q} className="input" placeholder="Title, slug or summary" />
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select name="status" defaultValue={status} className="select">
              <option value="">All</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace("_", " ").toLowerCase()} ({countFor(value)})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">Filter</button>
        </div>
      </form>

      <nav className="tabs mb-4" aria-label="Filter by status">
        <Link href={tabHref("")} className={`tab ${status === "" ? "tab-active" : ""}`}>
          All ({total})
        </Link>
        {STATUSES.map((value) => (
          <Link key={value} href={tabHref(value)} className={`tab ${status === value ? "tab-active" : ""}`}>
            {value.replace("_", " ").toLowerCase()} ({countFor(value)})
          </Link>
        ))}
      </nav>

      {posts.length === 0 ? (
        <div className="card"><div className="card-body">
          <EmptyState
            title="No articles yet"
            description="Write your first article — it will appear at /blog once you publish it."
            action={<Link href="/dashboard/blog/new" className="btn-primary btn-sm">Write an article</Link>}
          />
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Article</th><th>Category</th><th>Status</th><th>Author</th>
                <th className="text-right">Views</th><th>Updated</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <Link href={`/dashboard/blog/${post.id}`} className="font-semibold hover:underline">
                      {post.title}
                    </Link>
                    <span className="muted-xs block clamp-1">
                      /blog/{post.slug} · {post.readingMinutes} min read
                      {post.isFeatured ? " · featured" : ""}
                      {post.coverImageUrl ? "" : " · no cover image"}
                    </span>
                  </td>
                  <td className="text-xs">{post.category?.name ?? "—"}</td>
                  <td>
                    <StatusPill status={post.status} />
                    {post.publishedAt && post.publishedAt > new Date() ? (
                      <span className="muted-xs block">scheduled</span>
                    ) : null}
                  </td>
                  <td className="text-xs">{post.authorName ?? "—"}</td>
                  <td className="td-num">{post.viewCount}</td>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(post.updatedAt)}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {post.status === "PUBLISHED" ? (
                        <Link href={`/blog/${post.slug}`} className="btn-ghost btn-xs" target="_blank" rel="noopener noreferrer">
                          View
                        </Link>
                      ) : null}
                      {mayPublish ? (
                        <QuickActionForm
                          action={toggleBlogPostStatusAction}
                          values={{ id: post.id }}
                          label={post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                          className="btn-secondary btn-xs"
                        />
                      ) : null}
                      <Link href={`/dashboard/blog/${post.id}`} className="btn-secondary btn-xs">Edit</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / perPage))}
        buildHref={(next) => `/dashboard/blog${buildQuery({ q, status, page: next > 1 ? next : undefined })}`}
      />
    </>
  );
}
