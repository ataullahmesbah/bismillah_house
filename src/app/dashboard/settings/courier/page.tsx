import Link from "next/link";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { deleteCourierAction, saveCourierAction, saveCourierSettingsAction } from "@/app/actions/dashboard/settings";
import { COURIER_PROVIDERS, credentialsFor, getCourierAdapter } from "@/lib/courier/adapters";
import { getSettingGroup } from "@/lib/settings";
import { fromMinor } from "@/lib/money";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CourierSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.COURIER_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const [couriers, settings] = await Promise.all([
    prisma.courier.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, code: true, description: true, isActive: true, provider: true,
        apiBaseUrl: true, trackingUrlTemplate: true, position: true, defaultCharge: true,
        _count: { select: { shipments: true } },
      },
    }),
    getSettingGroup("courier"),
  ]);

  const editing = editId ? couriers.find((courier) => courier.id === editId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Courier integrations"
        description="Register the couriers you use. Manual tracking works today; API credentials can be added later."
      />

      <div className="alert-neutral mb-4">
        <div>
          <p>
            Credentials are read from environment variables, per courier code — never from the database, so a
            database dump is not a set of courier accounts. For a courier with code <code className="mono">PATHAO</code>:
          </p>
          <ul className="mt-2 space-y-0.5 text-xs">
            <li><code className="mono">COURIER_PATHAO_BASE_URL</code> — API endpoint</li>
            <li><code className="mono">COURIER_PATHAO_API_KEY</code> — access token</li>
            <li><code className="mono">COURIER_PATHAO_API_SECRET</code> — where the courier uses a pair</li>
            <li><code className="mono">COURIER_PATHAO_STORE_ID</code> — merchant/store id, where required</li>
            <li><code className="mono">COURIER_PATHAO_WEBHOOK_SECRET</code> — signs their status callbacks</li>
          </ul>
          <p className="mt-2">
            Point the courier&apos;s webhook at{" "}
            <code className="mono">{`${env.appUrl}/api/webhooks/courier/PATHAO`}</code>. Without the webhook secret
            the endpoint refuses every callback — an unauthenticated endpoint that can mark orders delivered is a way
            to steal stock.
          </p>
        </div>
      </div>

      <ActionForm action={saveCourierSettingsAction} className="card mb-4">
        <div className="card-header"><h2 className="card-title">Automation</h2></div>
        <div className="card-body stack">
          <label className="check-row">
            <input
              type="checkbox"
              name="syncOrderStatusFromCourier"
              className="checkbox mt-0.5"
              defaultChecked={settings.syncOrderStatusFromCourier}
            />
            <span>
              Move the order along when the courier reports progress
              <span className="form-hint block">
                Delivered at the courier marks the order delivered here. Only ever forwards — a late callback cannot
                drag a completed order backwards.
              </span>
            </span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              name="autoPostSettlementToFinance"
              className="checkbox mt-0.5"
              defaultChecked={settings.autoPostSettlementToFinance}
            />
            <span>
              Post courier charges and settlements to Accounts &amp; Finance
              <span className="form-hint block">Keeps the books in step without anyone re-keying the numbers.</span>
            </span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              name="customerTrackingEnabled"
              className="checkbox mt-0.5"
              defaultChecked={settings.customerTrackingEnabled}
            />
            <span>
              Show the parcel journey to customers
              <span className="form-hint block">On their order page and the public track-order page.</span>
            </span>
          </label>

          <div className="grid-form-2">
            <Field label="Retries before asking a human" htmlFor="maxDispatchRetries">
              <input
                id="maxDispatchRetries"
                name="maxDispatchRetries"
                type="number"
                min="0"
                max="10"
                className="input"
                defaultValue={settings.maxDispatchRetries}
              />
            </Field>
            <Field label="Default courier code" htmlFor="defaultCourierCode" hint="Used when the dispatcher does not pick one.">
              <input
                id="defaultCourierCode"
                name="defaultCourierCode"
                className="input uppercase"
                defaultValue={settings.defaultCourierCode}
                maxLength={30}
              />
            </Field>
          </div>
        </div>
        <div className="card-footer">
          <SubmitButton>Save automation settings</SubmitButton>
        </div>
      </ActionForm>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Couriers</h2></div>
          {couriers.length === 0 ? (
            <div className="card-body">
              <EmptyState title="No couriers yet" description="Add the courier services you dispatch with." />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead><tr><th>Courier</th><th>Integration</th><th className="text-right">Shipments</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {couriers.map((courier) => (
                    <tr key={courier.id}>
                      <td>
                        <p className="font-semibold">{courier.name}</p>
                        <p className="mono text-xs text-brand-400">{courier.code}</p>
                      </td>
                      <td className="text-xs">
                        {(() => {
                          const adapter = getCourierAdapter(courier.provider);
                          if (!adapter.supportsApi) return <span className="badge-outline">Manual</span>;
                          return credentialsFor(courier.code, courier.apiBaseUrl) ? (
                            <span className="badge-green">{adapter.label}</span>
                          ) : (
                            <span className="badge-amber">{adapter.label} — no credentials</span>
                          );
                        })()}
                      </td>
                      <td className="td-num">{courier._count.shipments}</td>
                      <td><span className={courier.isActive ? "badge-green" : "badge-gray"}>{courier.isActive ? "Active" : "Inactive"}</span></td>
                      <td className="td-actions">
                        <div className="inline-flex gap-1.5">
                          <Link href={`/dashboard/settings/courier?edit=${courier.id}`} className="btn-secondary btn-xs">Edit</Link>
                          <QuickActionForm
                            action={deleteCourierAction}
                            values={{ id: courier.id }}
                            label="Remove"
                            className="btn-danger-soft btn-xs"
                            confirm={`Remove ${courier.name}?`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ActionForm action={saveCourierAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit courier" : "Add courier"}</h2>
            {editing ? <Link href="/dashboard/settings/courier" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="Name" htmlFor="name" required>
              <input id="name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={80} placeholder="Pathao, Steadfast, RedX…" />
            </Field>
            <Field label="Code" htmlFor="code" required hint="Uppercase identifier used internally.">
              <input id="code" name="code" className="input uppercase" defaultValue={editing?.code ?? ""} required maxLength={30} />
            </Field>
            <Field label="Description" htmlFor="description">
              <input id="description" name="description" className="input" defaultValue={editing?.description ?? ""} maxLength={200} />
            </Field>
            <Field label="Integration" htmlFor="provider" hint="Which built-in adapter drives this courier.">
              <select id="provider" name="provider" className="select" defaultValue={editing?.provider ?? "manual"}>
                {COURIER_PROVIDERS.map((provider) => (
                  <option key={provider.key} value={provider.key}>
                    {provider.label}{provider.supportsApi ? "" : " (enter tracking by hand)"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="API base URL" htmlFor="apiBaseUrl" hint="Non-secret endpoint only.">
              <input id="apiBaseUrl" name="apiBaseUrl" className="input" defaultValue={editing?.apiBaseUrl ?? ""} maxLength={300} />
            </Field>
            <Field
              label="Tracking URL template"
              htmlFor="trackingUrlTemplate"
              hint="Use {tracking} where the number goes, e.g. https://courier.com/track/{tracking}"
            >
              <input id="trackingUrlTemplate" name="trackingUrlTemplate" className="input" defaultValue={editing?.trackingUrlTemplate ?? ""} maxLength={300} />
            </Field>
            <div className="grid-form-2">
              <Field label="Default charge" htmlFor="defaultCharge" hint="Used until the courier bills us.">
                <input
                  id="defaultCharge"
                  name="defaultCharge"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  defaultValue={fromMinor(editing?.defaultCharge ?? 0)}
                />
              </Field>
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? 0} />
              </Field>
              <label className="check-row self-end">
                <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
                <span>Active</span>
              </label>
            </div>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save courier" : "Add courier"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
