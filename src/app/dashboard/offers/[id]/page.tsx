import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { OfferForm, type OfferFormValues } from "@/components/dashboard/offer-form";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getCategoryOptions, getProductOptions } from "@/lib/services/picker-options";
import { toDateTimeLocalValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditOfferPage({ params }: { params: Params }) {
  const { id } = await params;
  await requirePermissionPage(PERMISSIONS.OFFER_MANAGE, "/dashboard/offers");

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { products: { select: { productId: true } }, categories: { select: { categoryId: true } } },
  });
  if (!offer) notFound();

  const [products, categories] = await Promise.all([getProductOptions(), getCategoryOptions()]);

  const values: OfferFormValues = {
    id: offer.id,
    title: offer.title,
    description: offer.description ?? "",
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    maxDiscountAmount: offer.maxDiscountAmount,
    scope: offer.scope,
    startAt: toDateTimeLocalValue(offer.startAt),
    endAt: toDateTimeLocalValue(offer.endAt),
    isActive: offer.isActive,
    priority: offer.priority,
    badgeText: offer.badgeText ?? "",
    showCountdown: offer.showCountdown,
    productIds: offer.products.map((row) => row.productId),
    categoryIds: offer.categories.map((row) => row.categoryId),
  };

  return (
    <>
      <PageHeader
        title={offer.title}
        description="Changes take effect immediately on the storefront."
        action={<Link href="/dashboard/offers" className="btn-ghost btn-sm">← All offers</Link>}
      />
      <OfferForm values={values} products={products} categories={categories} />
    </>
  );
}
