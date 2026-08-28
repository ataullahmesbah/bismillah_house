import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { OfferForm } from "@/components/dashboard/offer-form";
import { emptyOffer } from "@/lib/forms/marketing-defaults";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getCategoryOptions, getProductOptions } from "@/lib/services/picker-options";

export const dynamic = "force-dynamic";

export default async function NewOfferPage() {
  await requirePermissionPage(PERMISSIONS.OFFER_MANAGE, "/dashboard/offers");
  const [products, categories] = await Promise.all([getProductOptions(), getCategoryOptions()]);

  return (
    <>
      <PageHeader
        title="Create offer"
        description="Defaults to a two-hour window — adjust the schedule to whatever the campaign needs."
        action={<Link href="/dashboard/offers" className="btn-ghost btn-sm">← All offers</Link>}
      />
      <OfferForm values={emptyOffer()} products={products} categories={categories} />
    </>
  );
}
