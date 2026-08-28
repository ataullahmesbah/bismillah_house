import { PageHeader } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { listProductStock } from "@/lib/services/inventory";
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

  const { rows, total } = await listProductStock({
    q,
    filter: "out",
    skip: (page - 1) * perPage,
    take: perPage,
  });

  return (
    <>
      <PageHeader title="Out of stock" description="Nothing left to sell. These are turning shoppers away right now." />
      <InventoryTabs active="/dashboard/inventory/out-of-stock" />
      <StockFilters action="/dashboard/inventory/out-of-stock" q={q} />
      <StockTable
        rows={rows}
        total={total}
        page={page}
        perPage={perPage}
        basePath="/dashboard/inventory/out-of-stock"
        query={{ q }}
        showCost={showCost}
        emptyTitle="Nothing is out of stock"
        emptyDescription="Every product has at least one unit available."
      />
    </>
  );
}
