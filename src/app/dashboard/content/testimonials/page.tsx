import Link from "next/link";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader, Rating } from "@/components/ui";
import { deleteTestimonialAction, saveTestimonialAction } from "@/app/actions/dashboard/content";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TestimonialsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.CONTENT_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const testimonials = await prisma.testimonial.findMany({ orderBy: { position: "asc" } });
  const editing = editId ? testimonials.find((row) => row.id === editId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Shown in the homepage testimonials section. These are editorial quotes, separate from product reviews."
      />

      <div className="alert-neutral mb-4">
        <div>
          Only publish testimonials you genuinely received. Product star ratings shown to shoppers come from verified
          purchases and are never editable here.
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header"><h2 className="card-title">All testimonials ({testimonials.length})</h2></div>
          <div className="card-body stack">
            {testimonials.length === 0 ? (
              <EmptyState title="No testimonials yet" description="Add one on the right." />
            ) : (
              testimonials.map((testimonial) => (
                <div key={testimonial.id} className="row-between flex-wrap gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{testimonial.name}</p>
                      <Rating value={testimonial.rating} showCount={false} />
                    </div>
                    {testimonial.role ? <p className="muted-xs">{testimonial.role}</p> : null}
                    <p className="mt-1 text-sm text-brand-600">“{testimonial.body}”</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={testimonial.isActive ? "badge-green" : "badge-gray"}>
                      {testimonial.isActive ? "Live" : "Hidden"}
                    </span>
                    <Link href={`/dashboard/content/testimonials?edit=${testimonial.id}`} className="btn-secondary btn-xs">Edit</Link>
                    <QuickActionForm
                      action={deleteTestimonialAction}
                      values={{ id: testimonial.id }}
                      label="Delete"
                      className="btn-danger-soft btn-xs"
                      confirm="Delete this testimonial?"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <ActionForm action={saveTestimonialAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit testimonial" : "Add testimonial"}</h2>
            {editing ? <Link href="/dashboard/content/testimonials" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="Name" htmlFor="name" required errorFor="name">
              <input id="name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={120} />
            </Field>
            <Field label="Role / location" htmlFor="role">
              <input id="role" name="role" className="input" defaultValue={editing?.role ?? ""} maxLength={120} placeholder="Customer, Dhaka" />
            </Field>
            <Field label="Testimonial" htmlFor="body" required errorFor="body">
              <textarea id="body" name="body" className="textarea min-h-24" defaultValue={editing?.body ?? ""} required maxLength={1000} />
            </Field>
            <div className="grid-form-2">
              <Field label="Rating" htmlFor="rating">
                <select id="rating" name="rating" className="select" defaultValue={editing?.rating ?? 5}>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>
                  ))}
                </select>
              </Field>
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? testimonials.length} />
              </Field>
            </div>
            <Field label="Avatar URL" htmlFor="avatarUrl">
              <input id="avatarUrl" name="avatarUrl" className="input" defaultValue={editing?.avatarUrl ?? ""} maxLength={2048} />
            </Field>
            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
              <span>Show on the homepage</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save" : "Add testimonial"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
