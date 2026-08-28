import Link from "next/link";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { deleteHomeSectionAction, saveHomeSectionAction } from "@/app/actions/dashboard/content";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SECTION_TYPES = [
  ["HERO", "Hero banner"],
  ["CATEGORY_GRID", "Category grid"],
  ["FLASH_SALE", "Active flash sale"],
  ["FEATURED_PRODUCTS", "Featured products"],
  ["TOP_SELLING", "Top selling products"],
  ["NEW_ARRIVALS", "New arrivals"],
  ["BANNER", "Banner strip"],
  ["TRUST_BADGES", "Trust badges"],
  ["TESTIMONIALS", "Testimonials"],
  ["RICH_TEXT", "Custom HTML block"],
] as const;

export default async function HomeSectionsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.CONTENT_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const sections = await prisma.homeSection.findMany({ orderBy: { position: "asc" } });
  const editing = editId ? sections.find((section) => section.id === editId) ?? null : null;
  const config = (editing?.config ?? {}) as { limit?: number; html?: string };

  return (
    <>
      <PageHeader
        title="Homepage sections"
        description="Decide which blocks appear on the homepage, in what order, with what heading."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Sections in order</h2>
            <Link href="/dashboard/content/home" className="btn-secondary btn-xs">Add section</Link>
          </div>
          <div className="card-body">
            {sections.length === 0 ? (
              <EmptyState
                title="Using the default layout"
                description="Add sections here to take full control of the homepage. Until then a sensible default is rendered."
              />
            ) : (
              <ol className="stack">
                {sections.map((section, index) => (
                  <li key={section.id} className="row-between flex-wrap gap-2 rounded-[var(--radius-tm)] border border-line p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        <span className="mono mr-2 text-brand-400">{index + 1}.</span>
                        {section.title ?? SECTION_TYPES.find(([value]) => value === section.type)?.[1] ?? section.type}
                      </p>
                      <p className="muted-xs">
                        {section.type} · position {section.position} · key <span className="mono">{section.key}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={section.isActive ? "badge-green" : "badge-gray"}>
                        {section.isActive ? "Visible" : "Hidden"}
                      </span>
                      <Link href={`/dashboard/content/home?edit=${section.id}`} className="btn-secondary btn-xs">Edit</Link>
                      <QuickActionForm
                        action={deleteHomeSectionAction}
                        values={{ id: section.id }}
                        label="Remove"
                        className="btn-danger-soft btn-xs"
                        confirm="Remove this homepage section?"
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <ActionForm action={saveHomeSectionAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit section" : "Add section"}</h2>
            {editing ? <Link href="/dashboard/content/home" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <Field label="Section type" htmlFor="type" required>
              <select id="type" name="type" className="select" defaultValue={editing?.type ?? "FEATURED_PRODUCTS"}>
                {SECTION_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Key" htmlFor="key" required errorFor="key" hint="Unique identifier, e.g. featured-1.">
              <input id="key" name="key" className="input" defaultValue={editing?.key ?? ""} required maxLength={60} />
            </Field>
            <Field label="Heading" htmlFor="title">
              <input id="title" name="title" className="input" defaultValue={editing?.title ?? ""} maxLength={200} />
            </Field>
            <Field label="Subheading" htmlFor="subtitle">
              <input id="subtitle" name="subtitle" className="input" defaultValue={editing?.subtitle ?? ""} maxLength={300} />
            </Field>
            <div className="grid-form-2">
              <Field label="Product limit" htmlFor="limit" hint="For product sections.">
                <input id="limit" name="limit" type="number" min="2" max="48" className="input" defaultValue={config.limit ?? 8} />
              </Field>
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" max="99" className="input" defaultValue={editing?.position ?? sections.length} />
              </Field>
            </div>
            <Field label="Custom HTML" htmlFor="html" hint="Only used by the “Custom HTML block” type.">
              <textarea id="html" name="html" className="textarea min-h-24 font-mono text-xs" defaultValue={config.html ?? ""} maxLength={20000} />
            </Field>
            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
              <span>Visible on the homepage</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save section" : "Add section"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
