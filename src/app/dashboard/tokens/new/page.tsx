import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { Field, PageHeader } from "@/components/ui";
import { AssigneePicker } from "@/components/dashboard/assignee-picker";
import { createTokenAction } from "@/app/actions/dashboard/tokens";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { assignableStaff, TOKEN_CATEGORY_LABELS, TOKEN_PRIORITY_LABELS } from "@/lib/services/tokens";

export const dynamic = "force-dynamic";

export default async function NewTokenPage() {
  await requirePermissionPage(PERMISSIONS.TOKEN_CREATE);
  const staff = await assignableStaff();

  return (
    <>
      <PageHeader
        title="Raise a token"
        description="Ask another staff member to look at something. Tokens stay inside the dashboard."
      />

      <ActionForm action={createTokenAction} className="card max-w-3xl">
        <div className="card-body stack">
          <Field label="Subject" htmlFor="subject" required errorFor="subject">
            <input id="subject" name="subject" className="input" maxLength={160} required placeholder="Short summary of what is needed" />
          </Field>

          <div className="grid-form-2">
            <Field label="What is it about?" htmlFor="category" errorFor="category">
              <select id="category" name="category" className="select" defaultValue="OTHER">
                {Object.entries(TOKEN_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>

            <Field label="Priority" htmlFor="priority" errorFor="priority">
              <select id="priority" name="priority" className="select" defaultValue="NORMAL">
                {Object.entries(TOKEN_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="description"
            required
            errorFor="description"
            hint="What needs doing, and anything the assignee needs to know."
          >
            <textarea id="description" name="description" className="textarea" rows={6} maxLength={4000} required />
          </Field>

          <div className="grid-form-2">
            <Field label="Related to (optional)" htmlFor="relatedType" hint="e.g. order, payment, product.">
              <input id="relatedType" name="relatedType" className="input" maxLength={40} placeholder="order" />
            </Field>
            <Field label="Reference (optional)" htmlFor="relatedId" hint="Order number, product slug, transaction ID.">
              <input id="relatedId" name="relatedId" className="input" maxLength={60} placeholder="TM-260101-1001" />
            </Field>
          </div>

          <AssigneePicker staff={staff} />
        </div>

        <div className="card-footer">
          <SubmitButton>Raise token</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
