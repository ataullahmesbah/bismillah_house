import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceSheet } from "@/components/site/invoice-sheet";
import { PrintButton } from "@/components/site/print-button";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getInvoice, type InvoiceSnapshot } from "@/lib/services/orders";
import { getSettings } from "@/lib/settings";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** Print-ready packing invoice for the delivery package. */
export default async function DashboardInvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requirePermissionPage(PERMISSIONS.ORDER_INVOICE, "/dashboard/orders");

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
  if (!order) notFound();

  const [invoice, settings] = await Promise.all([getInvoice(order.id, user.id), getSettings()]);
  const snapshot = invoice.snapshot as unknown as InvoiceSnapshot;

  await recordAudit({
    actor: user,
    action: AUDIT_ACTIONS.INVOICE_DOWNLOADED,
    entityType: "invoice",
    entityId: invoice.id,
    summary: `Opened print invoice ${invoice.invoiceNumber}`,
  });

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/dashboard/orders/${order.id}`} className="btn-ghost btn-sm">← Back to order</Link>
        <div className="flex gap-2">
          <a href={`/api/orders/${order.id}/invoice`} className="btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <InvoiceSheet
        snapshot={snapshot}
        shop={{
          name: settings.site.siteName,
          address: settings.contact.address,
          phone: settings.contact.phone,
          email: settings.contact.supportEmail || settings.contact.email,
        }}
      />
    </>
  );
}
