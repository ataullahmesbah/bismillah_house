import { PageHeader } from "@/components/ui";
import { CustomerHistorySearch } from "@/components/dashboard/customer-search";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomerSearchPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.ORDER_CUSTOMER_SEARCH);
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : undefined;

  return (
    <>
      <PageHeader
        title="Customer order history"
        description="Check a phone number or email before dispatch — delivery, rejection, return and fraud history in one place."
      />
      <div className="alert-neutral mb-4">
        <div>
          This tool is staff-only and is never exposed on the storefront. Each lookup is written to the audit log.
        </div>
      </div>
      <CustomerHistorySearch defaultQuery={query} />
    </>
  );
}
