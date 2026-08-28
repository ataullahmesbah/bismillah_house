import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui";
import { QuickActionForm } from "@/components/dashboard/action-form";
import { archiveOfferAction } from "@/app/actions/dashboard/marketing";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  await requirePermissionPage(PERMISSIONS.OFFER_MANAGE);
  const now = new Date();

  const offers = await prisma.offer.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" }, { endAt: "desc" }],
    select: {
      id: true, title: true, discountType: true, discountValue: true, scope: true,
      startAt: true, endAt: true, isActive: true, priority: true, badgeText: true,
      _count: { select: { products: true, categories: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Promotional offers"
        description="Time-boxed campaigns — including short two-hour offers — applied automatically at checkout."
        action={<Link href="/dashboard/offers/new" className="btn-primary">Create offer</Link>}
      />

      {offers.length === 0 ? (
        <EmptyState
          title="No offers yet"
          description="Run a two-hour offer on selected products, or a store-wide percentage campaign."
          action={<Link href="/dashboard/offers/new" className="btn-primary">Create offer</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Offer</th><th>Discount</th><th>Applies to</th><th>Window</th><th>State</th><th /></tr>
            </thead>
            <tbody>
              {offers.map((offer) => {
                const live = offer.isActive && offer.startAt <= now && offer.endAt > now;
                const scheduled = offer.isActive && offer.startAt > now;
                return (
                  <tr key={offer.id}>
                    <td>
                      <Link href={`/dashboard/offers/${offer.id}`} className="font-semibold hover:underline">{offer.title}</Link>
                      {offer.badgeText ? <p className="muted-xs">Badge: {offer.badgeText}</p> : null}
                    </td>
                    <td className="font-semibold">
                      {offer.discountType === "PERCENT" ? `${offer.discountValue}%` : formatMoney(offer.discountValue)}
                    </td>
                    <td>
                      <span className="badge-outline">{offer.scope}</span>
                      <p className="muted-xs mt-1">
                        {offer.scope === "PRODUCT" ? `${offer._count.products} product(s)` : null}
                        {offer.scope === "CATEGORY" ? `${offer._count.categories} category(ies)` : null}
                      </p>
                    </td>
                    <td className="text-xs">
                      {formatDateTime(offer.startAt)}
                      <br />→ {formatDateTime(offer.endAt)}
                    </td>
                    <td>
                      <span className={live ? "badge-green" : scheduled ? "badge-blue" : "badge-gray"}>
                        {live ? "Live" : scheduled ? "Scheduled" : offer.isActive ? "Ended" : "Disabled"}
                      </span>
                    </td>
                    <td className="td-actions">
                      <div className="inline-flex gap-1.5">
                        <Link href={`/dashboard/offers/${offer.id}`} className="btn-secondary btn-xs">Edit</Link>
                        <QuickActionForm
                          action={archiveOfferAction}
                          values={{ id: offer.id }}
                          label="Archive"
                          className="btn-danger-soft btn-xs"
                          confirm={`Archive “${offer.title}”?`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
