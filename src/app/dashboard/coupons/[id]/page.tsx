import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { CouponForm, type CouponFormValues } from "@/components/dashboard/coupon-form";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getCategoryOptions, getProductOptions } from "@/lib/services/picker-options";
import { formatMoney } from "@/lib/money";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditCouponPage({ params }: { params: Params }) {
  const { id } = await params;
  await requirePermissionPage(PERMISSIONS.COUPON_MANAGE, "/dashboard/coupons");

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      products: { select: { productId: true } },
      categories: { select: { categoryId: true } },
      exclusions: { select: { productId: true } },
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true, amount: true, email: true, createdAt: true,
          order: { select: { id: true, orderNumber: true } },
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!coupon) notFound();

  const [products, categories] = await Promise.all([getProductOptions(), getCategoryOptions()]);

  const values: CouponFormValues = {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount,
    maxDiscountAmount: coupon.maxDiscountAmount,
    startAt: toDateTimeLocalValue(coupon.startAt),
    endAt: toDateTimeLocalValue(coupon.endAt),
    usageLimit: coupon.usageLimit,
    perCustomerLimit: coupon.perCustomerLimit,
    isActive: coupon.isActive,
    scope: coupon.scope,
    allowOnFlashSale: coupon.allowOnFlashSale,
    allowStacking: coupon.allowStacking,
    productIds: coupon.products.map((row) => row.productId),
    categoryIds: coupon.categories.map((row) => row.categoryId),
    excludedProductIds: coupon.exclusions.map((row) => row.productId),
  };

  return (
    <>
      <PageHeader
        title={`Coupon ${coupon.code}`}
        description={`Used ${coupon.usageCount} time(s)`}
        action={<Link href="/dashboard/coupons" className="btn-ghost btn-sm">← All coupons</Link>}
      />

      <CouponForm values={values} products={products} categories={categories} />

      {coupon.redemptions.length > 0 ? (
        <section className="card mt-4">
          <div className="card-header"><h2 className="card-title">Recent redemptions</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead><tr><th>Order</th><th>Customer</th><th>When</th><th className="text-right">Discount</th></tr></thead>
              <tbody>
                {coupon.redemptions.map((redemption) => (
                  <tr key={redemption.id}>
                    <td>
                      <Link href={`/dashboard/orders/${redemption.order.id}`} className="mono hover:underline">
                        {redemption.order.orderNumber}
                      </Link>
                    </td>
                    <td className="text-xs">{redemption.user?.name ?? redemption.email ?? "Guest"}</td>
                    <td className="text-xs">{formatDateTime(redemption.createdAt)}</td>
                    <td className="td-num">{formatMoney(redemption.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
