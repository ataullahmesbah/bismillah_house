import Link from "next/link";
import Image from "next/image";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { deleteBannerAction, saveBannerAction } from "@/app/actions/dashboard/marketing";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PLACEMENTS = [
  ["HOME_HERO", "Homepage hero"],
  ["HOME_BILLBOARD", "Homepage billboard"],
  ["HOME_STRIP", "Homepage strip"],
  ["CATEGORY_TOP", "Category top banner"],
  ["PRODUCT_SIDEBAR", "Product sidebar"],
  ["POPUP", "Popup / modal"],
  ["ANNOUNCEMENT", "Announcement"],
] as const;

export default async function BannersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.BANNER_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const [banners, settings] = await Promise.all([
    prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { priority: "desc" }] }),
    getSettings(),
  ]);

  const editing = editId ? banners.find((banner) => banner.id === editId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Banners & ads"
        description="Hero images, homepage strips, category banners and popups — all scheduled and prioritised here."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_23rem]">
        <div className="stack">
          {banners.length === 0 ? (
            <EmptyState title="No banners yet" description="Add your first hero banner on the right." />
          ) : (
            PLACEMENTS.map(([placement, label]) => {
              const group = banners.filter((banner) => banner.placement === placement);
              if (group.length === 0) return null;
              return (
                <section key={placement} className="card">
                  <div className="card-header">
                    <h2 className="card-title">{label}</h2>
                    <span className="muted-xs">{group.length}</span>
                  </div>
                  <div className="card-body stack">
                    {group.map((banner) => (
                      <div key={banner.id} className="flex flex-wrap items-start gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0">
                        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-[var(--radius-tm)] border border-line bg-surface-sunken">
                          {banner.imageUrl ? (
                            <Image src={banner.imageUrl} alt={banner.alt ?? banner.title} fill sizes="112px" className="object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[0.625rem] text-brand-400">No image</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{banner.title}</p>
                          {banner.subtitle ? <p className="muted-xs">{banner.subtitle}</p> : null}
                          <p className="muted-xs">
                            Priority {banner.priority}
                            {banner.linkUrl ? ` · ${banner.linkUrl}` : ""}
                            {banner.placement === "POPUP" ? ` · every ${banner.frequencyHours}h` : ""}
                          </p>
                          {banner.startAt || banner.endAt ? (
                            <p className="muted-xs">
                              {banner.startAt ? formatDateTime(banner.startAt) : "Always"} →{" "}
                              {banner.endAt ? formatDateTime(banner.endAt) : "no end"}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={banner.isActive ? "badge-green" : "badge-gray"}>
                            {banner.isActive ? "Active" : "Hidden"}
                          </span>
                          <div className="flex gap-1.5">
                            <Link href={`/dashboard/banners?edit=${banner.id}`} className="btn-secondary btn-xs">Edit</Link>
                            <QuickActionForm
                              action={deleteBannerAction}
                              values={{ id: banner.id }}
                              label="Delete"
                              className="btn-danger-soft btn-xs"
                              confirm={`Delete banner “${banner.title}”?`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <ActionForm action={saveBannerAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit banner" : "New banner"}</h2>
            {editing ? <Link href="/dashboard/banners" className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <Field label="Placement" htmlFor="placement" required errorFor="placement">
              <select id="placement" name="placement" className="select" defaultValue={editing?.placement ?? "HOME_HERO"}>
                {PLACEMENTS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Title" htmlFor="title" required errorFor="title">
              <input id="title" name="title" className="input" defaultValue={editing?.title ?? ""} required maxLength={160} />
            </Field>
            <Field label="Subtitle" htmlFor="subtitle">
              <input id="subtitle" name="subtitle" className="input" defaultValue={editing?.subtitle ?? ""} maxLength={300} />
            </Field>

            <ImageUploadField
              name="imageUrl"
              label="Desktop image"
              defaultValue={editing?.imageUrl ?? ""}
              folder="banners"
              recommendation={settings.upload.recommendedBanner}
              maxSizeMb={settings.upload.maxFileSizeMb}
            />
            <ImageUploadField
              name="mobileImageUrl"
              label="Mobile image (optional)"
              defaultValue={editing?.mobileImageUrl ?? ""}
              folder="banners"
              recommendation="800 × 800 px"
              maxSizeMb={settings.upload.maxFileSizeMb}
            />

            <Field label="Alt text" htmlFor="alt" hint="Describes the image for screen readers.">
              <input id="alt" name="alt" className="input" defaultValue={editing?.alt ?? ""} maxLength={200} />
            </Field>
            <div className="grid-form-2">
              <Field label="Link URL" htmlFor="linkUrl">
                <input id="linkUrl" name="linkUrl" className="input" defaultValue={editing?.linkUrl ?? ""} maxLength={2048} placeholder="/shop" />
              </Field>
              <Field label="Button label" htmlFor="ctaLabel" hint="Leave both blank to show no button at all.">
                <input id="ctaLabel" name="ctaLabel" className="input" defaultValue={editing?.ctaLabel ?? ""} maxLength={60} />
              </Field>
              <Field label="Second link URL" htmlFor="secondaryLinkUrl">
                <input
                  id="secondaryLinkUrl"
                  name="secondaryLinkUrl"
                  className="input"
                  defaultValue={editing?.secondaryLinkUrl ?? ""}
                  maxLength={2048}
                  placeholder="/track-order"
                />
              </Field>
              <Field
                label="Second button label"
                htmlFor="secondaryCtaLabel"
                hint="A button needs both a label and a link, or it is not shown."
              >
                <input
                  id="secondaryCtaLabel"
                  name="secondaryCtaLabel"
                  className="input"
                  defaultValue={editing?.secondaryCtaLabel ?? ""}
                  maxLength={60}
                />
              </Field>
            </div>
            <div className="grid-form-2">
              <Field label="Priority" htmlFor="priority" hint="Higher shows first.">
                <input id="priority" name="priority" type="number" min="0" className="input" defaultValue={editing?.priority ?? 0} />
              </Field>
              <Field label="Popup frequency (hours)" htmlFor="frequencyHours" hint="0 = show every visit.">
                <input id="frequencyHours" name="frequencyHours" type="number" min="0" max="720" className="input" defaultValue={editing?.frequencyHours ?? 24} />
              </Field>
            </div>
            <div className="grid-form-2">
              <Field label="Starts" htmlFor="startAt">
                <input id="startAt" name="startAt" type="datetime-local" className="input" defaultValue={editing?.startAt ? toDateTimeLocalValue(editing.startAt) : ""} />
              </Field>
              <Field label="Ends" htmlFor="endAt">
                <input id="endAt" name="endAt" type="datetime-local" className="input" defaultValue={editing?.endAt ? toDateTimeLocalValue(editing.endAt) : ""} />
              </Field>
            </div>
            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
              <span>Active</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save banner" : "Create banner"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
