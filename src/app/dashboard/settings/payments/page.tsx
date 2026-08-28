import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { Field, PageHeader } from "@/components/ui";
import { savePaymentSettingsAction } from "@/app/actions/dashboard/settings";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { fromMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  await requirePermissionPage(PERMISSIONS.SETTINGS_MANAGE);
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Payments"
        description="Cash on Delivery works out of the box. bKash and an online gateway are optional integrations."
      />

      <div className="alert-neutral mb-4">
        <div>
          Gateway credentials are read from environment variables and are never stored in the database.
          Current status — bKash: <strong>{env.bkash.configured ? "credentials present" : "not configured"}</strong>,
          SSLCommerz: <strong>{env.sslcommerz.configured ? "credentials present" : "not configured"}</strong>.
          You can still enable a method here to collect manual transaction IDs while credentials are pending.
        </div>
      </div>

      <ActionForm action={savePaymentSettingsAction} className="card">
        <div className="card-header"><h2 className="card-title">Available methods</h2></div>
        <div className="card-body stack">
          <label className="check-row">
            <input type="checkbox" name="codEnabled" className="checkbox mt-0.5" defaultChecked={settings.payment.codEnabled} />
            <span className="min-w-0">
              <span className="block font-semibold">Cash on Delivery</span>
              <span className="block text-xs text-brand-500">Fully functional with no third-party account.</span>
            </span>
          </label>
          <Field label="COD instructions" htmlFor="codInstructions">
            <input id="codInstructions" name="codInstructions" className="input" defaultValue={settings.payment.codInstructions} maxLength={300} />
          </Field>

          <div className="divider" />

          <label className="check-row">
            <input type="checkbox" name="bkashEnabled" className="checkbox mt-0.5" defaultChecked={settings.payment.bkashEnabled} />
            <span className="min-w-0">
              <span className="block font-semibold">bKash</span>
              <span className="block text-xs text-brand-500">
                Customers send money and submit a transaction ID that staff verify before confirming.
              </span>
            </span>
          </label>
          <div className="grid-form-2">
            <Field label="bKash merchant number" htmlFor="bkashMerchantNumber">
              <input id="bkashMerchantNumber" name="bkashMerchantNumber" className="input" defaultValue={settings.payment.bkashMerchantNumber} maxLength={30} />
            </Field>
            <Field label="bKash instructions" htmlFor="bkashInstructions">
              <input id="bkashInstructions" name="bkashInstructions" className="input" defaultValue={settings.payment.bkashInstructions} maxLength={300} />
            </Field>
          </div>

          <div className="divider" />

          <label className="check-row">
            <input type="checkbox" name="sslcommerzEnabled" className="checkbox mt-0.5" defaultChecked={settings.payment.sslcommerzEnabled} />
            <span className="min-w-0">
              <span className="block font-semibold">Online card gateway (SSLCommerz-ready)</span>
              <span className="block text-xs text-brand-500">
                Checkout and order records already treat payment status separately from order status, so a gateway
                can be connected later without redesigning anything.
              </span>
            </span>
          </label>

          <div className="divider" />

          <Field label="Minimum order amount (৳)" htmlFor="minOrderAmount" hint="0 = no minimum.">
            <input id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" min="0" className="input" defaultValue={fromMinor(settings.payment.minOrderAmount)} />
          </Field>
        </div>
        <div className="card-footer">
          <SubmitButton>Save payment settings</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
