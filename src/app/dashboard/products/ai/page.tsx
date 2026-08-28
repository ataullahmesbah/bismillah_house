import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { EmptyState, PageHeader, StatCard, StatusPill } from "@/components/ui";
import { generateProductDraftAction } from "@/app/actions/dashboard/ai";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { AI_PROVIDER_LIST } from "@/lib/ai/providers";
import { monthlyUsage } from "@/lib/ai/service";
import { getSettingGroup } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AiProductsPage() {
  await requirePermissionPage(PERMISSIONS.AI_USE);

  const [settings, usage, drafts] = await Promise.all([
    getSettingGroup("ai"),
    monthlyUsage(),
    prisma.aiProductDraft.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true, prompt: true, status: true, provider: true, model: true, createdAt: true,
        errorMessage: true, productId: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  const providers = AI_PROVIDER_LIST.map((provider) => ({
    key: provider.key,
    label: provider.label,
    consoleUrl: provider.consoleUrl,
    configured: provider.isConfigured(),
  }));
  const anyConfigured = providers.some((provider) => provider.configured);
  const modeOff = settings.productMode === "manual";

  return (
    <>
      <PageHeader
        title="AI product drafting"
        description="Describe a product; the AI writes a listing. You read it, fix it, and decide whether it goes live."
        action={<Link href="/dashboard/products/new" className="btn-secondary">Add by hand</Link>}
      />

      <div className="stat-grid mb-4">
        <StatCard label="Requests this month" value={usage.used} hint={`Budget ${usage.budget}`} />
        <StatCard label="Remaining" value={usage.remaining} />
        <StatCard label="Mode" value={settings.productMode} hint="Set in Settings → AI" />
        <StatCard label="Providers ready" value={providers.filter((p) => p.configured).length} />
      </div>

      {!anyConfigured || modeOff ? (
        <div className="alert-warning mb-4" role="status">
          <div>
            {modeOff ? (
              <p>
                AI drafting is switched off. Turn it on under{" "}
                <Link href="/dashboard/settings" className="link">Settings → AI assistant</Link>.
              </p>
            ) : (
              <p>No AI provider has a key yet, so drafting will fail. Products can still be added by hand.</p>
            )}
            <ul className="mt-2 space-y-0.5 text-xs">
              {providers.map((provider) => (
                <li key={provider.key}>
                  <strong>{provider.label}</strong>{" "}
                  {provider.configured ? (
                    <span className="text-success-600">ready</span>
                  ) : (
                    <>
                      needs <code className="mono">{provider.key.toUpperCase()}_API_KEY</code> —{" "}
                      <a href={provider.consoleUrl} target="_blank" rel="noopener noreferrer" className="link">
                        get one
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <section className="card self-start">
          <div className="card-header"><h2 className="card-title">Describe a product</h2></div>
          <ActionForm action={generateProductDraftAction} className="card-body space-y-4">
            <div className="field">
              <label className="label" htmlFor="ai-prompt">What is it?</label>
              <textarea
                id="ai-prompt"
                name="prompt"
                rows={5}
                className="textarea"
                maxLength={2000}
                required
                placeholder="e.g. Premium cotton Kabli panjabi for Eid, sizes M to XXL, navy and off-white, locally tailored"
                disabled={modeOff}
              />
              <p className="form-hint">
                The more you say about materials, sizes and who it is for, the less the AI has to guess — and it is
                told to leave a field blank rather than invent a specification.
              </p>
              <ContextFieldError name="prompt" />
            </div>
            <SubmitButton>{modeOff ? "AI drafting is off" : "Write a draft"}</SubmitButton>
          </ActionForm>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Drafts</h2></div>
          {drafts.length === 0 ? (
            <div className="card-body">
              <EmptyState
                title="No drafts yet"
                description="Describe a product on the left to get a listing you can edit and publish."
              />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr><th>Request</th><th>Status</th><th>Provider</th><th>When</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => (
                    <tr key={draft.id}>
                      <td>
                        <span className="clamp-2 text-sm">{draft.prompt}</span>
                        {draft.errorMessage ? (
                          <span className="muted-xs block text-danger-600 clamp-2">{draft.errorMessage}</span>
                        ) : null}
                        <span className="muted-xs block">{draft.actor?.name ?? "—"}</span>
                      </td>
                      <td><StatusPill status={draft.status} /></td>
                      <td className="text-xs">{draft.provider ?? "—"}</td>
                      <td className="text-xs whitespace-nowrap">{formatDateTime(draft.createdAt)}</td>
                      <td className="text-right">
                        {draft.productId ? (
                          <Link href={`/dashboard/products/${draft.productId}`} className="btn-secondary btn-xs">
                            Open product
                          </Link>
                        ) : draft.status === "READY" ? (
                          <Link href={`/dashboard/products/ai/${draft.id}`} className="btn-primary btn-xs">
                            Review
                          </Link>
                        ) : (
                          <span className="muted-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
