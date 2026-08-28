import Link from "next/link";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader, Pagination, Rating, StatusPill } from "@/components/ui";
import { deleteReviewAction, moderateReviewAction } from "@/app/actions/dashboard/engagement";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.REVIEW_MODERATE);
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "PENDING";
  const page = parsePositiveInt(typeof params.page === "string" ? params.page : undefined, 1, 1000);

  const where: Prisma.ReviewWhereInput = {
    deletedAt: null,
    ...(status && status !== "ALL" ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {}),
  };

  const [reviews, total, counts] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZES.dashboard,
      take: PAGE_SIZES.dashboard,
      select: {
        id: true, rating: true, title: true, body: true, status: true, createdAt: true,
        isVerifiedPurchase: true, authorName: true, reply: true,
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { name: true, email: true } },
        order: { select: { id: true, orderNumber: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
  ]);

  const countFor = (value: string) => counts.find((row) => row.status === value)?._count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZES.dashboard));

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Only customers who actually received a product can leave a review — moderate them here."
      />

      <div className="toolbar">
        {[
          ["PENDING", `Pending (${countFor("PENDING")})`],
          ["APPROVED", `Approved (${countFor("APPROVED")})`],
          ["REJECTED", `Rejected (${countFor("REJECTED")})`],
          ["ALL", "All"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/dashboard/reviews?status=${value}`}
            className={status === value ? "chip chip-active" : "chip"}
          >
            {label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <EmptyState title="Nothing here" description="No reviews match this filter." />
      ) : (
        <div className="stack">
          {reviews.map((review) => (
            <article key={review.id} className="card">
              <div className="card-header">
                <div className="min-w-0">
                  <Link href={`/product/${review.product.slug}`} className="clamp-1 text-sm font-bold hover:underline" target="_blank">
                    {review.product.name}
                  </Link>
                  <p className="muted-xs">
                    {review.user?.name ?? review.authorName ?? "Customer"}
                    {review.order ? ` · order ${review.order.orderNumber}` : ""}
                    {` · ${formatDateTime(review.createdAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Rating value={review.rating} showCount={false} />
                  {review.isVerifiedPurchase ? <span className="badge-green">Verified</span> : null}
                  {review._count.reports > 0 ? <span className="badge-red">{review._count.reports} report(s)</span> : null}
                  <StatusPill status={review.status} />
                </div>
              </div>

              <div className="card-body">
                {review.title ? <p className="font-semibold">{review.title}</p> : null}
                <p className="mt-1 text-sm leading-relaxed text-brand-700">{review.body}</p>

                <ActionForm action={moderateReviewAction} className="mt-4 border-t border-line pt-4">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                    <Field label="Decision" htmlFor={`status-${review.id}`}>
                      <select id={`status-${review.id}`} name="status" className="select" defaultValue={review.status}>
                        <option value="APPROVED">Approve</option>
                        <option value="PENDING">Keep pending</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                    </Field>
                    <Field label="Public reply (optional)" htmlFor={`reply-${review.id}`}>
                      <input id={`reply-${review.id}`} name="reply" className="input" defaultValue={review.reply ?? ""} maxLength={2000} />
                    </Field>
                    <div className="flex gap-2">
                      <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                      <QuickActionForm
                        action={deleteReviewAction}
                        values={{ id: review.id }}
                        label="Remove"
                        className="btn-danger-soft btn-sm"
                        confirm="Remove this review permanently from the storefront?"
                      />
                    </div>
                  </div>
                </ActionForm>
              </div>
            </article>
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) => `/dashboard/reviews${buildQuery({ status, page: next > 1 ? next : undefined })}`}
          />
        </div>
      )}
    </>
  );
}
