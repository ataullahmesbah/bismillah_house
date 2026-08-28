import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { Field, PageHeader } from "@/components/ui";
import { archiveExpenseCategoryAction, saveExpenseCategoryAction } from "@/app/actions/dashboard/finance";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";

import { FinanceTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.FINANCE_MANAGE);
  const params = await searchParams;
  const editId = Array.isArray(params.edit) ? params.edit[0] : params.edit;

  const [categories, editing] = await Promise.all([
    prisma.expenseCategory.findMany({
      orderBy: [{ kind: "asc" }, { position: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, kind: true, isSystem: true, isActive: true,
        _count: { select: { transactions: true } },
      },
    }),
    editId ? prisma.expenseCategory.findUnique({ where: { id: editId } }) : Promise.resolve(null),
  ]);

  const income = categories.filter((category) => category.kind === "INCOME");
  const expense = categories.filter((category) => category.kind === "EXPENSE");

  return (
    <>
      <PageHeader
        title="Categories"
        description="The buckets money is filed under. Retire one rather than deleting it — deleting would orphan its history."
      />
      <FinanceTabs active="/dashboard/finance/categories" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="card self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit category" : "Add category"}</h2>
          </div>
          <ActionForm action={saveExpenseCategoryAction} className="card-body space-y-4" successRedirect={false}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <Field label="Name" htmlFor="cat-name" required>
              <input id="cat-name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={120} />
              <ContextFieldError name="name" />
            </Field>

            <Field
              label="Side of the books"
              htmlFor="cat-kind"
              hint={editing?.isSystem ? "Fixed — this category is wired to automatic postings." : undefined}
            >
              <select
                id="cat-kind"
                name="kind"
                className="select"
                defaultValue={editing?.kind ?? "EXPENSE"}
                disabled={editing?.isSystem}
              >
                <option value="EXPENSE">Money out</option>
                <option value="INCOME">Money in</option>
              </select>
              {editing?.isSystem ? <input type="hidden" name="kind" value={editing.kind} /> : null}
            </Field>

            <SubmitButton>{editing ? "Save category" : "Add category"}</SubmitButton>
          </ActionForm>
        </section>

        <div className="stack">
          {[
            { title: "Money out", rows: expense },
            { title: "Money in", rows: income },
          ].map((group) => (
            <section className="card" key={group.title}>
              <div className="card-header"><h2 className="card-title">{group.title}</h2></div>
              <div className="table-wrap border-0">
                <table className="table table-compact">
                  <thead><tr><th>Name</th><th>Slug</th><th className="text-right">Entries</th><th className="text-right">Actions</th></tr></thead>
                  <tbody>
                    {group.rows.length === 0 ? (
                      <tr><td colSpan={4} className="muted py-6 text-center">Nothing here yet.</td></tr>
                    ) : (
                      group.rows.map((category) => (
                        <tr key={category.id} className={category.isActive ? undefined : "opacity-60"}>
                          <td>
                            <span className="font-medium">{category.name}</span>
                            {category.isSystem ? <span className="badge-outline ml-2">System</span> : null}
                            {!category.isActive ? <span className="badge-gray ml-2">Retired</span> : null}
                          </td>
                          <td className="mono text-xs">{category.slug}</td>
                          <td className="td-num">{category._count.transactions}</td>
                          <td className="text-right">
                            <div className="row-actions">
                              <a href={`/dashboard/finance/categories?edit=${category.id}`} className="btn-secondary btn-xs">
                                Edit
                              </a>
                              {!category.isSystem ? (
                                <QuickActionForm
                                  action={archiveExpenseCategoryAction}
                                  values={{ id: category.id }}
                                  label={category.isActive ? "Retire" : "Restore"}
                                  className="btn-ghost btn-xs"
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
