import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui";
import { QuickActionForm } from "@/components/dashboard/action-form";
import { archiveCouponAction, toggleCouponAction } from "@/app/actions/dashboard/marketing";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function couponState(coupon: { isActive: boolean; startAt: Date; endAt: Date; usageLimit: number | null; usageCount: number }) {
  const now = new Date();
  if (!coupon.isActive) return { label: "Disabled", className: "badge-gray" };
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { label: "Limit reached", className: "badge-amber" };
  }
  if (coupon.startAt > now) return { label: "Scheduled", className: "badge-blue" };
  if (coupon.endAt <= now) return { label: "Expired", className: "badge-gray" };
  return { label: "Live", className: "badge-green" };
}

export default async function CouponsPage() {
  await requirePermissionPage(PERMISSIONS.COUPON_MANAGE);

  const coupons = await prisma.coupon.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" }, { endAt: "desc" }],
    select: {
      id: true, code: true, title: true, discountType: true, discountValue: true,
      minOrderAmount: true, maxDiscountAmount: true, startAt: true, endAt: true,
      usageLimit: true, usageCount: true, perCustomerLimit: true, isActive: true,
      scope: true, allowOnFlashSale: true, allowStacking: true,
      _count: { select: { products: true, categories: true, redemptions: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Fixed or percentage discounts, scoped globally or to specific products and categories."
        action={<Link href="/dashboard/coupons/new" className="btn-primary">Create coupon</Link>}
      />

      {coupons.length === 0 ? (
        <EmptyState
          title="No coupons yet"
          description="Create a ৳100 product coupon or a 10% global coupon in under a minute."
          action={<Link href="/dashboard/coupons/new" className="btn-primary">Create coupon</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Discount</th><th>Scope</th><th>Window</th><th>Usage</th><th>State</th><th /></tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const state = couponState(coupon);
                return (
                  <tr key={coupon.id}>
                    <td>
                      <Link href={`/dashboard/coupons/${coupon.id}`} className="mono font-bold hover:underline">
                        {coupon.code}
                      </Link>
                      <p className="muted-xs clamp-1">{coupon.title}</p>
                    </td>
                    <td>
                      <p className="font-semibold">
                        {coupon.discountType === "PERCENT"
                          ? `${coupon.discountValue}%`
                          : formatMoney(coupon.discountValue)}
                      </p>
                      <p className="muted-xs">
                        {coupon.minOrderAmount > 0 ? `Min ${formatMoney(coupon.minOrderAmount)}` : "No minimum"}
                        {coupon.maxDiscountAmount ? ` · Max ${formatMoney(coupon.maxDiscountAmount)}` : ""}
                      </p>
                    </td>
                    <td>
                      <span className="badge-outline">{coupon.scope}</span>
                      <p className="muted-xs mt-1">
                        {coupon.scope === "PRODUCT" ? `${coupon._count.products} product(s)` : null}
                        {coupon.scope === "CATEGORY" ? `${coupon._count.categories} category(ies)` : null}
                        {coupon.allowOnFlashSale ? " · flash OK" : ""}
                        {coupon.allowStacking ? " · stacks" : ""}
                      </p>
                    </td>
                    <td className="text-xs">
                      {formatDateTime(coupon.startAt)}
                      <br />
                      → {formatDateTime(coupon.endAt)}
                    </td>
                    <td className="text-xs">
                      {coupon.usageCount}
                      {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : " / ∞"}
                      {coupon.perCustomerLimit ? <span className="muted-xs block">{coupon.perCustomerLimit} per customer</span> : null}
                    </td>
                    <td><span className={state.className}>{state.label}</span></td>
                    <td className="td-actions">
                      <div className="inline-flex flex-wrap gap-1.5">
                        <Link href={`/dashboard/coupons/${coupon.id}`} className="btn-secondary btn-xs">Edit</Link>
                        <QuickActionForm
                          action={toggleCouponAction}
                          values={{ id: coupon.id, isActive: coupon.isActive ? "false" : "true" }}
                          label={coupon.isActive ? "Disable" : "Enable"}
                          className={coupon.isActive ? "btn-ghost btn-xs" : "btn-success btn-xs"}
                        />
                        <QuickActionForm
                          action={archiveCouponAction}
                          values={{ id: coupon.id }}
                          label="Archive"
                          className="btn-danger-soft btn-xs"
                          confirm={`Archive coupon ${coupon.code}? Past redemptions are kept.`}
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
