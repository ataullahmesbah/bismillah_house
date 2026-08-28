import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { Field, PageHeader } from "@/components/ui";
import { saveOperationsSettingsAction } from "@/app/actions/dashboard/settings";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { fromMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function OperationsSettingsPage() {
  await requirePermissionPage(PERMISSIONS.SETTINGS_MANAGE);
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Inventory &amp; finance settings"
        description="How stock is counted and when a sale becomes revenue."
      />

      <ActionForm action={saveOperationsSettingsAction} className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Inventory</h2></div>
          <div className="card-body stack">
            <div className="grid-form-2">
              <Field label="Default low-stock alert" htmlFor="defaultLowStockThreshold" hint="Used when a product sets none of its own.">
                <input
                  id="defaultLowStockThreshold"
                  name="defaultLowStockThreshold"
                  type="number"
                  min="0"
                  className="input"
                  defaultValue={settings.inventory.defaultLowStockThreshold}
                />
              </Field>
              <Field label="Default reorder level" htmlFor="defaultReorderLevel">
                <input
                  id="defaultReorderLevel"
                  name="defaultReorderLevel"
                  type="number"
                  min="0"
                  className="input"
                  defaultValue={settings.inventory.defaultReorderLevel}
                />
              </Field>
              <Field
                label="Show &ldquo;only N left&rdquo; below"
                htmlFor="showStockCountBelow"
                hint="Urgency that is honest — the number shown is the real one."
              >
                <input
                  id="showStockCountBelow"
                  name="showStockCountBelow"
                  type="number"
                  min="0"
                  className="input"
                  defaultValue={settings.inventory.showStockCountBelow}
                />
              </Field>
              <Field label="Value stock at" htmlFor="valuationBasis">
                <select id="valuationBasis" name="valuationBasis" className="select" defaultValue={settings.inventory.valuationBasis}>
                  <option value="cost">What we paid</option>
                  <option value="retail">What we sell it for</option>
                </select>
              </Field>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                name="lowStockBannerEnabled"
                className="checkbox mt-0.5"
                defaultChecked={settings.inventory.lowStockBannerEnabled}
              />
              <span>Warn on the dashboard when stock drops below its alert level</span>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                name="trackWarehouses"
                className="checkbox mt-0.5"
                defaultChecked={settings.inventory.trackWarehouses}
              />
              <span>Attribute stock movements to warehouses</span>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                name="allowNegativeStock"
                className="checkbox mt-0.5"
                defaultChecked={settings.inventory.allowNegativeStock}
              />
              <span>
                Allow stock to go negative
                <span className="form-hint block">
                  Off by default. On, an adjustment can take stock below zero — useful when a count is being
                  reconciled, dangerous the rest of the time.
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Finance</h2></div>
          <div className="card-body stack">
            <Field
              label="Count a sale as revenue"
              htmlFor="revenueRecognition"
              hint="Cash on delivery is not money until it arrives, so delivery is the safer choice."
            >
              <select
                id="revenueRecognition"
                name="revenueRecognition"
                className="select"
                defaultValue={settings.finance.revenueRecognition}
              >
                <option value="on_delivery">When the order is delivered</option>
                <option value="on_order">When the order is confirmed</option>
              </select>
            </Field>

            <div className="grid-form-2">
              <Field label="Financial year starts" htmlFor="fiscalYearStartMonth">
                <select
                  id="fiscalYearStartMonth"
                  name="fiscalYearStartMonth"
                  className="select"
                  defaultValue={settings.finance.fiscalYearStartMonth}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </Field>

              <Field label="Packaging cost per order" htmlFor="packagingCostPerOrder" hint="Posted automatically with each sale.">
                <input
                  id="packagingCostPerOrder"
                  name="packagingCostPerOrder"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  defaultValue={fromMinor(settings.finance.packagingCostPerOrder)}
                />
              </Field>

              <Field label="Default cash account code" htmlFor="defaultCashAccountCode">
                <input
                  id="defaultCashAccountCode"
                  name="defaultCashAccountCode"
                  className="input"
                  defaultValue={settings.finance.defaultCashAccountCode}
                  maxLength={30}
                />
              </Field>

              <Field label="Courier receivable account code" htmlFor="defaultCourierAccountCode">
                <input
                  id="defaultCourierAccountCode"
                  name="defaultCourierAccountCode"
                  className="input"
                  defaultValue={settings.finance.defaultCourierAccountCode}
                  maxLength={30}
                />
              </Field>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                name="trackCostOfGoods"
                className="checkbox mt-0.5"
                defaultChecked={settings.finance.trackCostOfGoods}
              />
              <span>
                Post product cost alongside each sale
                <span className="form-hint block">
                  Needs cost prices on your products. Without it, gross profit is the same as revenue.
                </span>
              </span>
            </label>
          </div>
        </section>

        <div className="lg:col-span-2">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
