import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { saveFlashSaleAction } from "@/app/actions/dashboard/marketing";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FlashSalesPage() {
  await requirePermissionPage(PERMISSIONS.FLASH_SALE_MANAGE);
  const now = new Date();

  const sales = await prisma.flashSale.findMany({
    orderBy: [{ isActive: "desc" }, { endAt: "desc" }],
    select: {
      id: true, title: true, startAt: true, endAt: true, isActive: true, position: true,
      _count: { select: { items: true } },
    },
  });

  const start = toDateTimeLocalValue(now);
  const end = toDateTimeLocalValue(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  return (
    <>
      <PageHeader title="Flash sales" description="Time-limited campaigns with their own sale price and stock limit per product." />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header"><h2 className="card-title">All flash sales</h2></div>
          {sales.length === 0 ? (
            <div className="card-body">
              <EmptyState title="No flash sales yet" description="Create one on the right, then add products to it." />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead><tr><th>Sale</th><th>Window</th><th className="text-right">Products</th><th>State</th><th /></tr></thead>
                <tbody>
                  {sales.map((sale) => {
                    const live = sale.isActive && sale.startAt <= now && sale.endAt > now;
                    return (
                      <tr key={sale.id}>
                        <td>
                          <Link href={`/dashboard/flash-sales/${sale.id}`} className="font-semibold hover:underline">
                            {sale.title}
                          </Link>
                        </td>
                        <td className="text-xs">
                          {formatDateTime(sale.startAt)}
                          <br />→ {formatDateTime(sale.endAt)}
                        </td>
                        <td className="td-num">{sale._count.items}</td>
                        <td>
                          <span className={live ? "badge-green" : sale.isActive ? "badge-blue" : "badge-gray"}>
                            {live ? "Live" : sale.isActive ? "Scheduled / ended" : "Disabled"}
                          </span>
                        </td>
                        <td className="td-actions">
                          <Link href={`/dashboard/flash-sales/${sale.id}`} className="btn-secondary btn-xs">Manage</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ActionForm action={saveFlashSaleAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header"><h2 className="card-title">New flash sale</h2></div>
          <div className="card-body stack">
            <input type="hidden" name="id" value="" />
            <Field label="Title" htmlFor="title" required errorFor="title">
              <input id="title" name="title" className="input" required maxLength={160} placeholder="Weekend flash sale" />
            </Field>
            <Field label="Description" htmlFor="description">
              <textarea id="description" name="description" className="textarea min-h-16" maxLength={600} />
            </Field>
            <Field label="Starts" htmlFor="startAt" required errorFor="startAt">
              <input id="startAt" name="startAt" type="datetime-local" className="input" defaultValue={start} required />
            </Field>
            <Field label="Ends" htmlFor="endAt" required errorFor="endAt">
              <input id="endAt" name="endAt" type="datetime-local" className="input" defaultValue={end} required />
            </Field>
            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked />
              <span>Active</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>Create flash sale</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
