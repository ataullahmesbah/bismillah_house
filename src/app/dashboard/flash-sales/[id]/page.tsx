import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { SearchSelect } from "@/components/dashboard/pickers";
import { Field, PageHeader } from "@/components/ui";
import { addFlashSaleItemAction, removeFlashSaleItemAction, saveFlashSaleAction } from "@/app/actions/dashboard/marketing";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getProductOptions } from "@/lib/services/picker-options";
import { discountPercent, formatMoney } from "@/lib/money";
import { toDateTimeLocalValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function FlashSaleDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  await requirePermissionPage(PERMISSIONS.FLASH_SALE_MANAGE, "/dashboard/flash-sales");

  const sale = await prisma.flashSale.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true, salePrice: true, stockLimit: true, soldCount: true,
          product: { select: { id: true, name: true, price: true, stock: true, slug: true } },
          variant: { select: { name: true, price: true } },
        },
      },
    },
  });
  if (!sale) notFound();

  const products = await getProductOptions();

  return (
    <>
      <PageHeader
        title={sale.title}
        description={`${sale.items.length} product(s) in this sale`}
        action={<Link href="/dashboard/flash-sales" className="btn-ghost btn-sm">← All flash sales</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Products in this sale</h2></div>
          {sale.items.length === 0 ? (
            <div className="card-body"><p className="muted">No products yet — add one on the right.</p></div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr><th>Product</th><th className="text-right">Normal</th><th className="text-right">Sale price</th><th className="text-right">Sold / limit</th><th /></tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => {
                    const normal = item.variant?.price ?? item.product.price;
                    const percent = discountPercent(normal, item.salePrice);
                    return (
                      <tr key={item.id}>
                        <td>
                          <Link href={`/dashboard/products/${item.product.id}`} className="font-medium hover:underline">
                            {item.product.name}
                          </Link>
                          {item.variant ? <p className="muted-xs">{item.variant.name}</p> : null}
                        </td>
                        <td className="td-num">{formatMoney(normal)}</td>
                        <td className="td-num">
                          <span className="font-bold text-danger-600">{formatMoney(item.salePrice)}</span>
                          {percent ? <span className="muted-xs block">-{percent}%</span> : null}
                        </td>
                        <td className="td-num">
                          {item.soldCount}
                          {item.stockLimit !== null ? ` / ${item.stockLimit}` : " / ∞"}
                        </td>
                        <td className="td-actions">
                          <QuickActionForm
                            action={removeFlashSaleItemAction}
                            values={{ itemId: item.id }}
                            label="Remove"
                            className="btn-danger-soft btn-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stack">
          <ActionForm action={addFlashSaleItemAction} className="card">
            <div className="card-header"><h2 className="card-title">Add a product</h2></div>
            <div className="card-body stack">
              <input type="hidden" name="flashSaleId" value={sale.id} />
              <input type="hidden" name="variantId" value="" />
              <SearchSelect name="productId" label="Product" options={products} required />
              <Field label="Sale price (৳)" htmlFor="salePrice" required errorFor="salePrice" hint="Must be lower than the normal price.">
                <input id="salePrice" name="salePrice" type="number" step="0.01" min="0" className="input" required />
              </Field>
              <Field label="Stock limit" htmlFor="stockLimit" hint="Blank = no campaign limit.">
                <input id="stockLimit" name="stockLimit" type="number" min="0" className="input" />
              </Field>
            </div>
            <div className="card-footer">
              <SubmitButton className="btn-secondary">Add to sale</SubmitButton>
            </div>
          </ActionForm>

          <ActionForm action={saveFlashSaleAction} className="card">
            <div className="card-header"><h2 className="card-title">Sale settings</h2></div>
            <div className="card-body stack">
              <input type="hidden" name="id" value={sale.id} />
              <Field label="Title" htmlFor="title" required errorFor="title">
                <input id="title" name="title" className="input" defaultValue={sale.title} required maxLength={160} />
              </Field>
              <Field label="Description" htmlFor="description">
                <textarea id="description" name="description" className="textarea min-h-16" defaultValue={sale.description ?? ""} maxLength={600} />
              </Field>
              <Field label="Starts" htmlFor="startAt" required errorFor="startAt">
                <input id="startAt" name="startAt" type="datetime-local" className="input" defaultValue={toDateTimeLocalValue(sale.startAt)} required />
              </Field>
              <Field label="Ends" htmlFor="endAt" required errorFor="endAt">
                <input id="endAt" name="endAt" type="datetime-local" className="input" defaultValue={toDateTimeLocalValue(sale.endAt)} required />
              </Field>
              <label className="check-row">
                <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={sale.isActive} />
                <span>Active</span>
              </label>
            </div>
            <div className="card-footer">
              <SubmitButton>Save settings</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
