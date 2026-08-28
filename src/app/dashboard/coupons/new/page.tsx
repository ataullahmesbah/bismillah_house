import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { CouponForm } from "@/components/dashboard/coupon-form";
import { emptyCoupon } from "@/lib/forms/marketing-defaults";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getCategoryOptions, getProductOptions } from "@/lib/services/picker-options";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  await requirePermissionPage(PERMISSIONS.COUPON_MANAGE, "/dashboard/coupons");
  const [products, categories] = await Promise.all([getProductOptions(), getCategoryOptions()]);

  return (
    <>
      <PageHeader
        title="Create coupon"
        description="Set the discount, who it applies to, and exactly when it runs."
        action={<Link href="/dashboard/coupons" className="btn-ghost btn-sm">← All coupons</Link>}
      />
      <CouponForm values={emptyCoupon()} products={products} categories={categories} />
    </>
  );
}
