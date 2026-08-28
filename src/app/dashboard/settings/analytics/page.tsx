import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { Field, PageHeader } from "@/components/ui";
import { saveAnalyticsSettingsAction } from "@/app/actions/dashboard/settings";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AnalyticsSettingsPage() {
  await requirePermissionPage(PERMISSIONS.ANALYTICS_MANAGE);
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Analytics & tracking"
        description="Paste your IDs here — no source-code change is needed to start or stop tracking."
      />

      <ActionForm action={saveAnalyticsSettingsAction} className="stack">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Tracking IDs</h2></div>
          <div className="card-body grid-form-2">
            <Field label="GA4 measurement ID" htmlFor="ga4MeasurementId" hint="Looks like G-XXXXXXXXXX.">
              <input id="ga4MeasurementId" name="ga4MeasurementId" className="input mono" defaultValue={settings.analytics.ga4MeasurementId} maxLength={40} placeholder="G-XXXXXXXXXX" />
            </Field>
            <Field label="Google Tag Manager container" htmlFor="gtmContainerId" hint="Looks like GTM-XXXXXX.">
              <input id="gtmContainerId" name="gtmContainerId" className="input mono" defaultValue={settings.analytics.gtmContainerId} maxLength={40} placeholder="GTM-XXXXXX" />
            </Field>
            <Field label="Meta Pixel ID" htmlFor="metaPixelId">
              <input id="metaPixelId" name="metaPixelId" className="input mono" defaultValue={settings.analytics.metaPixelId} maxLength={40} />
            </Field>
            <Field label="Meta CAPI dataset ID" htmlFor="metaCapiDatasetId">
              <input id="metaCapiDatasetId" name="metaCapiDatasetId" className="input mono" defaultValue={settings.analytics.metaCapiDatasetId} maxLength={40} />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Meta Conversions API</h2></div>
          <div className="card-body stack">
            <label className="check-row">
              <input type="checkbox" name="metaCapiEnabled" className="checkbox mt-0.5" defaultChecked={settings.analytics.metaCapiEnabled} />
              <span className="min-w-0">
                <span className="block font-semibold">Send server-side conversion events</span>
                <span className="block text-xs text-brand-500">
                  Requires <code className="mono">META_CAPI_ACCESS_TOKEN</code> in your environment —{" "}
                  {env.metaCapiToken ? "currently present" : "not set yet"}.
                </span>
              </span>
            </label>
            <div className="alert-neutral">
              <div>
                The access token is a secret and is never stored in the database or exposed to the browser.
                Only the non-secret dataset ID lives here.
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Consent</h2></div>
          <div className="card-body stack">
            <label className="check-row">
              <input type="checkbox" name="requireConsent" className="checkbox mt-0.5" defaultChecked={settings.analytics.requireConsent} />
              <span className="min-w-0">
                <span className="block font-semibold">Ask for consent before loading tracking scripts</span>
                <span className="block text-xs text-brand-500">
                  Nothing loads until the visitor accepts. Turn this on if your market requires it.
                </span>
              </span>
            </label>
            <Field label="Consent banner text" htmlFor="consentText">
              <input id="consentText" name="consentText" className="input" defaultValue={settings.analytics.consentText} maxLength={300} />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Events sent</h2></div>
          <div className="card-body">
            <p className="text-sm text-brand-600">
              The storefront emits <code className="mono">view_item</code>, <code className="mono">add_to_cart</code>,{" "}
              <code className="mono">begin_checkout</code>, <code className="mono">purchase</code>,{" "}
              <code className="mono">search</code>, <code className="mono">sign_up</code> and{" "}
              <code className="mono">login</code> with product ids, names and values. Customer names, phone numbers
              and addresses are never included.
            </p>
          </div>
          <div className="card-footer">
            <SubmitButton>Save tracking settings</SubmitButton>
          </div>
        </section>
      </ActionForm>
    </>
  );
}
