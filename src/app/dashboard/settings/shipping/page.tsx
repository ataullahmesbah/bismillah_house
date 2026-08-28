import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { DistrictManager } from "@/components/dashboard/district-table";
import { Field, PageHeader } from "@/components/ui";
import { saveShippingSettingsAction } from "@/app/actions/dashboard/settings";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { fromMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ShippingSettingsPage() {
  await requirePermissionPage(PERMISSIONS.SHIPPING_MANAGE);

  const [districts, settings] = await Promise.all([
    prisma.district.findMany({
      orderBy: [{ division: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, nameBn: true, division: true,
        deliveryCharge: true, isFreeDelivery: true, isActive: true, estimatedDays: true,
      },
    }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Delivery & districts"
        description="All 64 Bangladesh districts, each independently configurable, plus the rules for mixed carts."
      />

      <ActionForm action={saveShippingSettingsAction} className="card mb-4">
        <div className="card-header"><h2 className="card-title">Global delivery rules</h2></div>
        <div className="card-body stack">
          <div className="grid-form-3">
            <Field
              label="Fallback charge (৳)"
              htmlFor="defaultCharge"
              hint="Used for the cart estimate before a district is chosen."
            >
              <input id="defaultCharge" name="defaultCharge" type="number" step="0.01" min="0" className="input" defaultValue={fromMinor(settings.shipping.defaultCharge)} />
            </Field>
            <Field
              label="Free delivery over (৳)"
              htmlFor="freeDeliveryOverAmount"
              hint="Blank to disable the threshold."
            >
              <input
                id="freeDeliveryOverAmount"
                name="freeDeliveryOverAmount"
                type="number"
                step="0.01"
                min="0"
                className="input"
                defaultValue={settings.shipping.freeDeliveryOverAmount ? fromMinor(settings.shipping.freeDeliveryOverAmount) : ""}
              />
            </Field>
            <Field
              label="Mixed cart strategy"
              htmlFor="mixedCartStrategy"
              hint="How product-level overrides combine with the district charge."
            >
              <select id="mixedCartStrategy" name="mixedCartStrategy" className="select" defaultValue={settings.shipping.mixedCartStrategy}>
                <option value="highest">Charge the single highest applicable amount</option>
                <option value="sum">Add every applicable charge together</option>
                <option value="district_only">Always use the district charge only</option>
              </select>
            </Field>
          </div>

          <Field label="Delivery note" htmlFor="note" hint="Shown on the cart, product page and checkout.">
            <textarea id="note" name="note" className="textarea min-h-16" defaultValue={settings.shipping.note} maxLength={400} />
          </Field>

          <div className="alert-neutral">
            <div>
              Product-level overrides (free delivery or a fixed charge) are set on each product under{" "}
              <strong>Products → Delivery</strong>. The final charge is always recalculated on the server at checkout.
            </div>
          </div>
        </div>
        <div className="card-footer">
          <SubmitButton>Save delivery rules</SubmitButton>
        </div>
      </ActionForm>

      <DistrictManager districts={districts} />
    </>
  );
}
