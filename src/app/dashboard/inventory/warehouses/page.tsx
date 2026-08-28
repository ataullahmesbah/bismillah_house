import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { saveWarehouseAction } from "@/app/actions/dashboard/inventory";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getWarehouseBalances } from "@/lib/services/inventory";

import { InventoryTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WarehousesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.WAREHOUSE_MANAGE);
  const params = await searchParams;
  const editId = Array.isArray(params.edit) ? params.edit[0] : params.edit;

  const [warehouses, balances, editing] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: [{ isDefault: "desc" }, { position: "asc" }, { name: "asc" }] }),
    getWarehouseBalances(),
    editId ? prisma.warehouse.findUnique({ where: { id: editId } }) : Promise.resolve(null),
  ]);

  const unitsByWarehouse = new Map(balances.map((row) => [row.warehouseId, row]));
  const untracked = unitsByWarehouse.get(null);

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Where stock physically sits. Balances are summed from the movement ledger, so they always match it."
      />
      <InventoryTabs active="/dashboard/inventory/warehouses" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <section className="card self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit warehouse" : "Add warehouse"}</h2>
          </div>
          <ActionForm action={saveWarehouseAction} className="card-body space-y-4" successRedirect={false}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <Field label="Name" htmlFor="wh-name">
              <input id="wh-name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={120} />
              <ContextFieldError name="name" />
            </Field>

            <Field label="Code" htmlFor="wh-code" hint="Short, unique, used in exports — e.g. dhaka-main.">
              <input id="wh-code" name="code" className="input" defaultValue={editing?.code ?? ""} required maxLength={24} />
              <ContextFieldError name="code" />
            </Field>

            <Field label="City" htmlFor="wh-city">
              <input id="wh-city" name="city" className="input" defaultValue={editing?.city ?? ""} maxLength={80} />
            </Field>

            <Field label="Address" htmlFor="wh-address">
              <textarea id="wh-address" name="address" rows={2} className="textarea" defaultValue={editing?.address ?? ""} maxLength={300} />
            </Field>

            <Field label="Phone" htmlFor="wh-phone">
              <input id="wh-phone" name="phone" className="input" defaultValue={editing?.phone ?? ""} maxLength={30} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sort order" htmlFor="wh-position">
                <input id="wh-position" name="position" type="number" min="0" max="999" className="input" defaultValue={editing?.position ?? 0} />
              </Field>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                name="isDefault"
                className="checkbox mt-0.5"
                defaultChecked={editing?.isDefault ?? warehouses.length === 0}
              />
              <span>Default warehouse — adjustments land here unless another is picked</span>
            </label>

            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
              <span>Active</span>
            </label>

            <SubmitButton>{editing ? "Save warehouse" : "Add warehouse"}</SubmitButton>
          </ActionForm>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">All warehouses</h2></div>
          {warehouses.length === 0 ? (
            <div className="card-body">
              <EmptyState
                title="No warehouses yet"
                description="Add one to start attributing stock movements to a location. Inventory works without them."
              />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Code</th><th>City</th><th className="text-right">Net units</th><th className="text-right">Movements</th><th></th></tr>
                </thead>
                <tbody>
                  {warehouses.map((warehouse) => {
                    const balance = unitsByWarehouse.get(warehouse.id);
                    return (
                      <tr key={warehouse.id}>
                        <td>
                          <span className="font-semibold">{warehouse.name}</span>
                          {warehouse.isDefault ? <span className="badge-accent ml-2">Default</span> : null}
                          {!warehouse.isActive ? <span className="badge-outline ml-2">Inactive</span> : null}
                        </td>
                        <td className="text-xs">{warehouse.code}</td>
                        <td className="text-xs">{warehouse.city ?? "—"}</td>
                        <td className="td-num">{balance?.units ?? 0}</td>
                        <td className="td-num">{balance?.movements ?? 0}</td>
                        <td className="text-right">
                          <a href={`/dashboard/inventory/warehouses?edit=${warehouse.id}`} className="btn-secondary btn-xs">Edit</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {untracked && untracked.movements > 0 ? (
            <div className="card-body border-t border-line">
              <p className="muted-xs">
                {untracked.movements} movement(s) totalling {untracked.units} units are not attributed to a
                warehouse — they predate warehouse tracking or were recorded without one.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
