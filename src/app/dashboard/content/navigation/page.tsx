import Link from "next/link";
import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { Field, PageHeader } from "@/components/ui";
import { deleteNavigationItemAction, saveNavigationItemAction } from "@/app/actions/dashboard/content";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { MENU_KEYS } from "@/lib/services/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MENUS = [
  [MENU_KEYS.MAIN, "Main navigation"],
  [MENU_KEYS.FOOTER_SHOP, "Footer — Shop"],
  [MENU_KEYS.FOOTER_HELP, "Footer — Help"],
  [MENU_KEYS.FOOTER_COMPANY, "Footer — Company"],
] as const;

export default async function NavigationPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.NAVIGATION_MANAGE);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;
  const activeMenu = typeof params.menu === "string" ? params.menu : MENU_KEYS.MAIN;

  const [items, categories, pages] = await Promise.all([
    prisma.navigationItem.findMany({
      orderBy: [{ position: "asc" }, { label: "asc" }],
      select: {
        id: true, label: true, type: true, url: true, parentId: true, position: true,
        isActive: true, openInNewTab: true, isMegaColumn: true, description: true, badgeText: true,
        categoryId: true, pageId: true,
        menu: { select: { key: true } },
        category: { select: { name: true } },
        page: { select: { title: true } },
      },
    }),
    prisma.category.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.page.findMany({ where: { isPublished: true }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  const editing = editId ? items.find((item) => item.id === editId) ?? null : null;
  const menuItems = items.filter((item) => item.menu.key === activeMenu);
  const rootItems = menuItems.filter((item) => !item.parentId);

  return (
    <>
      <PageHeader
        title="Navigation & footer"
        description="The header menu, mega-menu columns and every footer link — all database driven."
      />

      <div className="toolbar">
        {MENUS.map(([key, label]) => (
          <a key={key} href={`/dashboard/content/navigation?menu=${key}`} className={activeMenu === key ? "chip chip-active" : "chip"}>
            {label}
          </a>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_23rem]">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">{MENUS.find(([key]) => key === activeMenu)?.[1]}</h2>
            <span className="muted-xs">{menuItems.length} item(s)</span>
          </div>
          <div className="card-body stack">
            {rootItems.length === 0 ? (
              <p className="muted">No items in this menu yet — add one on the right.</p>
            ) : (
              rootItems.map((item) => {
                const children = menuItems.filter((child) => child.parentId === item.id);
                return (
                  <div key={item.id} className="rounded-[var(--radius-tm)] border border-line p-3">
                    <div className="row-between flex-wrap gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {item.label}
                          {item.badgeText ? <span className="badge-accent ml-2">{item.badgeText}</span> : null}
                          {item.isMegaColumn ? <span className="badge-outline ml-2">Mega menu</span> : null}
                        </p>
                        <p className="muted-xs">
                          {item.type} ·{" "}
                          {item.type === "CATEGORY"
                            ? item.category?.name
                            : item.type === "PAGE"
                              ? item.page?.title
                              : item.url}
                          {` · position ${item.position}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={item.isActive ? "badge-green" : "badge-gray"}>{item.isActive ? "Live" : "Hidden"}</span>
                        <Link href={`/dashboard/content/navigation?menu=${activeMenu}&edit=${item.id}`} className="btn-secondary btn-xs">Edit</Link>
                        <QuickActionForm
                          action={deleteNavigationItemAction}
                          values={{ id: item.id }}
                          label="Delete"
                          className="btn-danger-soft btn-xs"
                          confirm={`Remove “${item.label}” and its sub-items?`}
                        />
                      </div>
                    </div>

                    {children.length > 0 ? (
                      <ul className="mt-2 space-y-1 border-l border-line pl-3">
                        {children.map((child) => (
                          <li key={child.id} className="row-between gap-2 text-sm">
                            <span className="min-w-0">
                              <span className="clamp-1">{child.label}</span>
                              <span className="muted-xs block">
                                {child.type === "CATEGORY" ? child.category?.name : child.type === "PAGE" ? child.page?.title : child.url}
                              </span>
                            </span>
                            <span className="flex shrink-0 gap-1.5">
                              <Link href={`/dashboard/content/navigation?menu=${activeMenu}&edit=${child.id}`} className="btn-ghost btn-xs">Edit</Link>
                              <QuickActionForm
                                action={deleteNavigationItemAction}
                                values={{ id: child.id }}
                                label="×"
                                className="btn-danger-soft btn-xs"
                                confirm={`Remove “${child.label}”?`}
                              />
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <ActionForm action={saveNavigationItemAction} className="card lg:sticky lg:top-20 lg:self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit menu item" : "New menu item"}</h2>
            {editing ? <Link href={`/dashboard/content/navigation?menu=${activeMenu}`} className="btn-link text-xs">Cancel</Link> : null}
          </div>
          <div className="card-body stack">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <input type="hidden" name="menuKey" value={editing?.menu.key ?? activeMenu} />

            <Field label="Label" htmlFor="label" required errorFor="label">
              <input id="label" name="label" className="input" defaultValue={editing?.label ?? ""} required maxLength={80} />
            </Field>

            <Field label="Link type" htmlFor="type" required>
              <select id="type" name="type" className="select" defaultValue={editing?.type ?? "INTERNAL"}>
                <option value="INTERNAL">Internal path</option>
                <option value="CATEGORY">Category</option>
                <option value="PAGE">Content page</option>
                <option value="EXTERNAL">External URL</option>
              </select>
            </Field>

            <Field label="URL / path" htmlFor="url" errorFor="url" hint="For internal or external links, e.g. /shop">
              <input id="url" name="url" className="input" defaultValue={editing?.url ?? ""} maxLength={2048} />
            </Field>

            <Field label="Category" htmlFor="categoryId" errorFor="categoryId">
              <select id="categoryId" name="categoryId" className="select" defaultValue={editing?.categoryId ?? ""}>
                <option value="">—</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Page" htmlFor="pageId" errorFor="pageId">
              <select id="pageId" name="pageId" className="select" defaultValue={editing?.pageId ?? ""}>
                <option value="">—</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>{page.title}</option>
                ))}
              </select>
            </Field>

            <Field label="Parent item" htmlFor="parentId" hint="Leave empty for a top-level item.">
              <select id="parentId" name="parentId" className="select" defaultValue={editing?.parentId ?? ""}>
                <option value="">Top level</option>
                {rootItems
                  .filter((item) => item.id !== editing?.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
              </select>
            </Field>

            <div className="grid-form-2">
              <Field label="Badge" htmlFor="badgeText" hint="e.g. New, Sale">
                <input id="badgeText" name="badgeText" className="input" defaultValue={editing?.badgeText ?? ""} maxLength={20} />
              </Field>
              <Field label="Position" htmlFor="position">
                <input id="position" name="position" type="number" min="0" className="input" defaultValue={editing?.position ?? 0} />
              </Field>
            </div>

            <Field label="Description" htmlFor="description" hint="Shown under the label in mega menus.">
              <input id="description" name="description" className="input" defaultValue={editing?.description ?? ""} maxLength={200} />
            </Field>

            <label className="check-row">
              <input type="checkbox" name="isActive" className="checkbox mt-0.5" defaultChecked={editing?.isActive ?? true} />
              <span>Visible</span>
            </label>
            <label className="check-row">
              <input type="checkbox" name="openInNewTab" className="checkbox mt-0.5" defaultChecked={editing?.openInNewTab ?? false} />
              <span>Open in a new tab</span>
            </label>
            <label className="check-row">
              <input type="checkbox" name="isMegaColumn" className="checkbox mt-0.5" defaultChecked={editing?.isMegaColumn ?? false} />
              <span>Render children as a wide mega menu</span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>{editing ? "Save item" : "Add item"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
