import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceSheet } from "@/components/site/invoice-sheet";
import { PrintButton } from "@/components/site/print-button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getInvoice, type InvoiceSnapshot } from "@/lib/services/orders";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Invoice", path: "/account/orders", noIndex: true });
}

export default async function CustomerInvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser();

  // Ownership is enforced by the query itself.
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { id: true, orderNumber: true },
  });
  if (!order) notFound();

  const [invoice, settings] = await Promise.all([getInvoice(order.id, user.id), getSettings()]);
  const snapshot = invoice.snapshot as unknown as InvoiceSnapshot;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/account/orders/${order.id}`} className="btn-ghost btn-sm">← Back to order</Link>
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
