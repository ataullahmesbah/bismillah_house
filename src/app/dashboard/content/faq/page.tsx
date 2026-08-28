import Link from "next/link";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { deleteFaqAction, saveFaqAction } from "@/app/actions/dashboard/content";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FaqAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.CONTENT_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const faqs = await prisma.faq.findMany({ orderBy: [{ category: "asc" }, { position: "asc" }] });
  const editing = editId ? faqs.find((faq) => faq.id === editId) ?? null : null;
  const categories = [...new Set(faqs.map((faq) => faq.category))];

  return (
    <>
      <PageHeader
        title="FAQ"
        description="Published answers power the /faq page, the help centre, FAQPage structured data and the AI assistant."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="stack">
          {faqs.length === 0 ? (
            <EmptyState title="No FAQ entries yet" description="Add the questions customers ask most." />
          ) : (
            categories.map((category) => (
              <section key={category} className="card">
                <div className="card-header"><h2 className="card-title">{category}</h2></div>
                <div className="card-body stack">
                  {faqs
                    .filter((faq) => faq.category === category)
                    .map((faq) => (
                      <div key={faq.id} className="row-between flex-wrap gap-2 border-b border-line pb-3 last:border-b-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{faq.question}</p>
                          <p className="muted-xs clamp-2" dangerouslySetInnerHTML={{ __html: faq.answer }} />
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={faq.isActive ? "badge-green" : "badge-gray"}>{faq.isActive ? "Live" : "Hidden"}</span>
                          <Link href={`/dashboard/content/faq?edit=${faq.id}`} className="btn-secondary btn-xs">Edit</Link>
                          <QuickActionForm
                            action={deleteFaqAction}
                            values={{ id: faq.id }}
                            label="Delete"
                            className="btn-danger-soft btn-xs"
                            confirm="Delete this FAQ entry?"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            ))
          )}
        </div>

        <ActionForm action={saveFaqAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit entry" : "New entry"}</h2>
            {editing ? <Link href="/dashboard/content/faq" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="Question" htmlFor="question" required errorFor="question">
              <input id="question" name="question" className="input" defaultValue={editing?.question ?? ""} required maxLength={300} />
            </Field>
            <Field label="Answer" htmlFor="answer" required errorFor="answer" hint="Simple HTML allowed.">
              <textarea id="answer" name="answer" className="textarea min-h-32" defaultValue={editing?.answer ?? ""} required maxLength={8000} />
            </Field>
            <div className="grid-form-2">
              <Field label="Category" htmlFor="category" required>
                <input id="category" name="category" className="input" defaultValue={editing?.category ?? "General"} required maxLength={60} list="faq-categories" />
              </Field>
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? 0} />
              </Field>
            </div>
            <datalist id="faq-categories">
              {categories.map((category) => <option key={category} value={category} />)}
            </datalist>
            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
              <span>Published</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save entry" : "Add entry"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
