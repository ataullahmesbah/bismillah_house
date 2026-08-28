import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { PageHeader, StatusPill } from "@/components/ui";
import { receiveIncomingStockAction } from "@/app/actions/dashboard/inventory";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";

import { InventoryTabs } from "../../nav";

export const dynamic = "force-dynamic";

export default async function IncomingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermissionPage([PERMISSIONS.INVENTORY_RECEIVE, PERMISSIONS.INVENTORY_MANAGE]);
  const { id } = await params;

  const shipment = await prisma.stockIncoming.findUnique({
    where: { id },
    select: {
      id: true, reference: true, supplierName: true, supplierPhone: true, status: true,
      expectedAt: true, receivedAt: true, shippingCost: true, note: true, createdAt: true,
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        select: {
          id: true, quantity: true, receivedQuantity: true, unitCost: true,
          product: { select: { id: true, name: true } },
          variant: { select: { name: true } },
        },
      },
    },
  });
  if (!shipment) notFound();

  const closed = shipment.status === "RECEIVED" || shipment.status === "CANCELLED";
  const ordered = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
  const received = shipment.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
  const value = shipment.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  return (
    <>
      <PageHeader
        title={shipment.reference}
        description={`From ${shipment.supplierName}${shipment.warehouse ? ` · arriving at ${shipment.warehouse.name}` : ""}`}
        action={<Link href="/dashboard/inventory/incoming" className="btn-secondary">Back to incoming</Link>}
      />
      <InventoryTabs active="/dashboard/inventory/incoming" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">{closed ? "Lines" : "Receive stock"}</h2>
            <StatusPill status={shipment.status} />
          </div>

          {closed ? (
            <div className="table-wrap border-0">
              <table className="table table-compact">
                <thead>
                  <tr><th>Product</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">Unit cost</th></tr>
                </thead>
                <tbody>
                  {shipment.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link href={`/dashboard/products/${item.product.id}`} className="hover:underline">{item.product.name}</Link>
                        {item.variant ? <span className="muted-xs block">{item.variant.name}</span> : null}
                      </td>
                      <td className="td-num">{item.quantity}</td>
                      <td className="td-num">{item.receivedQuantity}</td>
                      <td className="td-num">{formatMoney(item.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ActionForm action={receiveIncomingStockAction} successRedirect={false}>
              <input type="hidden" name="incomingId" value={shipment.id} />
              <div className="table-wrap border-0">
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Product</th><th className="text-right">Ordered</th>
                      <th className="text-right">Already in</th><th className="text-right">Receiving now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.items.map((item) => {
                      const outstanding = item.quantity - item.receivedQuantity;
                      return (
                        <tr key={item.id}>
                          <td>
                            <Link href={`/dashboard/products/${item.product.id}`} className="hover:underline">
                              {item.product.name}
                            </Link>
                            {item.variant ? <span className="muted-xs block">{item.variant.name}</span> : null}
                            <input type="hidden" name="itemIds" value={item.id} />
                          </td>
                          <td className="td-num">{item.quantity}</td>
                          <td className="td-num">{item.receivedQuantity}</td>
                          <td className="text-right">
                            <input
                              name="receivedQuantities"
                              type="number"
                              min="0"
                              max={outstanding}
                              defaultValue={outstanding}
                              className="input h-9 w-24 text-right"
                              disabled={outstanding <= 0}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="card-body">
                <p className="form-hint mb-3">
                  Suppliers short-ship. Enter what actually arrived — anything left over stays counted as incoming
                  until this shipment is closed.
                </p>
                <SubmitButton>Receive into stock</SubmitButton>
              </div>
            </ActionForm>
          )}
        </section>

        <aside className="card self-start">
          <div className="card-header"><h2 className="card-title">Summary</h2></div>
          <div className="card-body space-y-2 text-sm">
            <div className="row-between"><span className="muted">Ordered</span><span>{ordered} units</span></div>
            <div className="row-between"><span className="muted">Received</span><span>{received} units</span></div>
            <div className="row-between"><span className="muted">Goods value</span><span>{formatMoney(value)}</span></div>
            <div className="row-between"><span className="muted">Freight</span><span>{formatMoney(shipment.shippingCost)}</span></div>
            <div className="row-between border-t border-line pt-2 font-bold">
              <span>Total</span><span>{formatMoney(value + shipment.shippingCost)}</span>
            </div>
            <div className="row-between"><span className="muted">Expected</span><span>{shipment.expectedAt ? formatDate(shipment.expectedAt) : "—"}</span></div>
            <div className="row-between"><span className="muted">Received on</span><span>{shipment.receivedAt ? formatDate(shipment.receivedAt) : "—"}</span></div>
            <div className="row-between"><span className="muted">Supplier phone</span><span>{shipment.supplierPhone ?? "—"}</span></div>
            <div className="row-between"><span className="muted">Recorded by</span><span>{shipment.createdBy?.name ?? "—"}</span></div>
            <div className="row-between"><span className="muted">Recorded on</span><span>{formatDateTime(shipment.createdAt)}</span></div>
            {shipment.note ? <p className="muted-xs border-t border-line pt-2">{shipment.note}</p> : null}
          </div>
        </aside>
      </div>
    </>
  );
}
