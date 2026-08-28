import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";
import { AddressManager } from "@/components/site/account-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getDistricts } from "@/lib/services/catalog";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Addresses", path: "/account/addresses", noIndex: true });
}

export default async function AddressesPage() {
  const user = await requireUser();

  const [addresses, districts] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, label: true, type: true, fullName: true, phone: true, districtId: true,
        districtName: true, city: true, area: true, addressLine1: true, postalCode: true, isDefault: true,
      },
    }),
    getDistricts(),
  ]);

  return (
    <>
      <PageHeader title="Delivery addresses" description="Save addresses so checkout takes a few seconds." />
      <AddressManager
        addresses={addresses}
        districts={districts.map((district) => ({ id: district.id, name: district.name, division: district.division }))}
      />
    </>
  );
}
