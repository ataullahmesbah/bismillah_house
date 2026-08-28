import { PageHeader } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { listVariantStock } from "@/lib/services/inventory";
import { parsePositiveInt } from "@/lib/utils";

import { InventoryTabs } from "../nav";
import { StockFilters, StockTable } from "../stock-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAnyPermissionPage([PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  // What a product cost us is commercially sensitive; a support moderator sees
  // stock counts without it.
  const showCost = await userHasPermission(user, PERMISSIONS.INVENTORY_MANAGE);

  const { rows, total } = await listVariantStock({
    q,
    filter: "all",
    skip: (page - 1) * perPage,
    take: perPage,
  });

  return (
    <>
      <PageHeader title="Variants stock" description="Stock held per size, colour or pack — the variant is what sells, not the parent." />
      <InventoryTabs active="/dashboard/inventory/variants" />
      <StockFilters action="/dashboard/inventory/variants" q={q} />
      <StockTable
        rows={rows}
        total={total}
        page={page}
        perPage={perPage}
        basePath="/dashboard/inventory/variants"
        query={{ q }}
        showCost={showCost}
        emptyTitle="No variants found"
        emptyDescription="Products with options will appear here once their variants exist."
      />
    </>
  );
}
