import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { EmptyState, PageHeader, Rating, StatusPill } from "@/components/ui";
import { ReviewForm } from "@/components/site/account-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getReviewableItems } from "@/lib/services/orders";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "My reviews", path: "/account/reviews", noIndex: true });
}

export default async function AccountReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const focusItemId = typeof params.item === "string" ? params.item : null;

  const [pendingItems, myReviews, settings] = await Promise.all([
    getReviewableItems(user.id),
    prisma.review.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, rating: true, title: true, body: true, status: true, createdAt: true, reply: true,
        product: { select: { name: true, slug: true } },
      },
    }),
    getSettings(),
  ]);

  const focused = focusItemId ? pendingItems.find((item) => item.id === focusItemId) : null;

  return (
    <>
      <PageHeader
        title="My reviews"
        description={
          settings.features.requireDeliveredForReview
            ? "You can review a product once your order has been delivered."
            : "Share your experience with products you have ordered."
        }
      />

      {focused && focused.productId ? (
        <div className="mb-6">
          <ReviewForm productId={focused.productId} orderItemId={focused.id} productName={focused.productName} />
        </div>
      ) : null}

      <section className="card">
        <div className="card-header"><h2 className="card-title">Waiting for your review</h2></div>
        <div className="card-body">
          {pendingItems.length === 0 ? (
            <p className="muted">Nothing to review right now.</p>
          ) : (
            <ul className="stack">
              {pendingItems.map((item) => (
                <li key={item.id} className="row-between flex-wrap gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-tm)] border border-line bg-white">
                      {item.imageUrl ? <Image src={item.imageUrl} alt={item.productName} fill sizes="48px" className="object-contain" /> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="clamp-1 text-sm font-semibold">{item.productName}</p>
                      <p className="muted-xs">
                        Order {item.order.orderNumber}
                        {item.order.deliveredAt ? ` · delivered ${formatDate(item.order.deliveredAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  <Link href={`/account/reviews?item=${item.id}`} className="btn-secondary btn-sm">Write a review</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card mt-4">
        <div className="card-header"><h2 className="card-title">Your published reviews</h2></div>
        <div className="card-body">
          {myReviews.length === 0 ? (
            <EmptyState title="No reviews yet" description="Reviews you write will be listed here." />
          ) : (
            <ul className="stack">
              {myReviews.map((review) => (
                <li key={review.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                  <div className="row-between flex-wrap gap-2">
                    <Link href={`/product/${review.product.slug}`} className="text-sm font-semibold hover:underline">
                      {review.product.name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Rating value={review.rating} showCount={false} />
                      <StatusPill status={review.status} />
                    </div>
                  </div>
                  {review.title ? <p className="mt-1.5 text-sm font-semibold">{review.title}</p> : null}
                  {review.body ? <p className="mt-1 text-sm text-brand-600">{review.body}</p> : null}
                  <p className="muted-xs mt-1">{formatDate(review.createdAt)}</p>
                  {review.reply ? (
                    <div className="mt-2 rounded-[var(--radius-tm)] bg-surface-muted p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-500">Reply from us</p>
                      <p className="mt-1 text-brand-700">{review.reply}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
