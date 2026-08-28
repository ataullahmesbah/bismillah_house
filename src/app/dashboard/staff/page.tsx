import Link from "next/link";

import { ActionForm, QuickActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { EmptyState, Field, PageHeader, StatusPill } from "@/components/ui";
import { saveStaffAction, setUserStatusAction } from "@/app/actions/dashboard/people";
import { prisma } from "@/lib/db";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS, STAFF_ROLES, STAFF_TABS } from "@/lib/constants";
import { buildQuery, formatDate, formatDateTime } from "@/lib/utils";
import { PasswordInput } from "@/components/ui/password-input";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermissionPage(PERMISSIONS.STAFF_VIEW);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const tabKey = typeof params.tab === "string" ? params.tab : "all";
  const tab = STAFF_TABS.find((entry) => entry.key === tabKey) ?? STAFF_TABS[0];

  const whereFor = (entry: (typeof STAFF_TABS)[number]) => ({
    deletedAt: null,
    // A role tab means that role only; a status tab means staff in that state.
    ...(entry.roles.length > 0
      ? { role: { in: [...entry.roles] } }
      : { role: { in: STAFF_ROLES } }),
    ...(entry.status ? { status: entry.status } : {}),
  });

  const [staff, canManage, editing] = await Promise.all([
    prisma.user.findMany({
      where: whereFor(tab),
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, email: true, phone: true, role: true, status: true,
        lastLoginAt: true, createdAt: true, staffNote: true,
        _count: { select: { permissions: true } },
      },
    }),
    userHasPermission(actor, PERMISSIONS.STAFF_MANAGE),

    /*
     * Looked up by id rather than searched for in the list above.
     *
     * The list is filtered by the current tab, so finding the row there meant
     * promoting a customer to staff was impossible: you open the Customers
     * tab, click Edit, and the link lands you back on "All staff" — where a
     * customer is not listed — leaving a blank create form instead of their
     * details.
     */
    editId
      ? prisma.user.findFirst({
          where: { id: editId, deletedAt: null },
          select: {
            id: true, name: true, email: true, phone: true, role: true, status: true,
            lastLoginAt: true, createdAt: true, staffNote: true,
          },
        })
      : Promise.resolve(null),
  ]);
  const isSuperAdmin = actor.role === "SUPER_ADMIN";

  return (
    <>
      <PageHeader
        title="Staff & roles"
        description="Admins and moderators. The Super Admin account cannot be edited, demoted or suspended by anyone else."
        action={isSuperAdmin ? <Link href="/dashboard/staff/roles" className="btn-secondary">Role permissions</Link> : undefined}
      />

      <nav className="tabs mb-4" aria-label="Staff views">
        {STAFF_TABS.map((entry) => (
          <Link
            key={entry.key}
            href={`/dashboard/staff${buildQuery({ tab: entry.key })}`}
            className={entry.key === tab.key ? "tab tab-active" : "tab"}
            aria-current={entry.key === tab.key ? "page" : undefined}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header"><h2 className="card-title">{tab.label} ({staff.length})</h2></div>
          {staff.length === 0 ? (
            <div className="card-body"><EmptyState title="No staff yet" description="Create your first admin account." /></div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
                <tbody>
                  {staff.map((member) => {
                    /*
                     * An owner can manage other owners — a shop with two
                     * owners needs one able to revoke the other when they
                     * leave. Everyone else still sees the owner as untouchable,
                     * and nobody edits their own account from here.
                     */
                    const isProtected =
                      (member.role === "SUPER_ADMIN" && !isSuperAdmin) || member.id === actor.id;
                    return (
                      <tr key={member.id}>
                        <td>
                          <p className="font-semibold">{member.name}</p>
                          <p className="muted-xs">{member.email}</p>
                          {member._count.permissions > 0 ? (
                            <span className="badge-outline mt-1">{member._count.permissions} override(s)</span>
                          ) : null}
                        </td>
                        <td>
                          <span className={isProtected ? "badge-dark" : "badge-gray"}>{member.role.replace("_", " ")}</span>
                        </td>
                        <td><StatusPill status={member.status} /></td>
                        <td className="text-xs">
                          {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                          <span className="muted-xs block">Joined {formatDate(member.createdAt)}</span>
                        </td>
                        <td className="td-actions">
                          {isProtected ? (
                            <span className="muted-xs">
                              {member.id === actor.id ? "This is you" : "Protected"}
                            </span>
                          ) : (
                            <div className="inline-flex gap-1.5">
                              {isSuperAdmin ? (
                                <Link href={`/dashboard/staff/${member.id}`} className="btn-ghost btn-xs">Permissions</Link>
                              ) : null}
                              {canManage ? (
                                <>
                                  <Link
                                    href={`/dashboard/staff${buildQuery({ tab: tab.key, edit: member.id })}`}
                                    className="btn-secondary btn-xs"
                                  >
                                    Edit
                                  </Link>
                                  {member.status === "ACTIVE" ? (
                                    <QuickActionForm
                                      action={setUserStatusAction}
                                      values={{ id: member.id, status: "SUSPENDED" }}
                                      label="Suspend"
                                      className="btn-danger-soft btn-xs"
                                      confirm={`Suspend ${member.name}? They will be signed out immediately.`}
                                    />
                                  ) : (
                                    <QuickActionForm
                                      action={setUserStatusAction}
                                      values={{ id: member.id, status: "ACTIVE" }}
                                      label="Reactivate"
                                      className="btn-success btn-xs"
                                    />
                                  )}
                                </>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {canManage ? (
          <ActionForm action={saveStaffAction} className="card lg:sticky lg:top-20 lg:self-start">
            <div className="card-header">
              <h2 className="card-title">{editing ? `Edit ${editing.name}` : "New staff member"}</h2>
              {editing ? <Link href="/dashboard/staff" className="btn-link text-xs">Cancel</Link> : null}
            </div>
            <div className="card-body stack">
              <input type="hidden" name="id" value={editing?.id ?? ""} />

              {!isSuperAdmin ? (
                <div className="alert-warning">
                  <div>Only a Super Admin can create staff or change roles.</div>
                </div>
              ) : null}

              <Field label="Full name" htmlFor="name" required errorFor="name">
                <input id="name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={120} />
              </Field>
              <Field label="Email" htmlFor="email" required errorFor="email">
                <input id="email" name="email" type="email" className="input" defaultValue={editing?.email ?? ""} required maxLength={160} readOnly={Boolean(editing)} />
              </Field>
              <Field label="Mobile number" htmlFor="phone" required errorFor="phone">
                <input id="phone" name="phone" className="input" defaultValue={editing?.phone ?? ""} required maxLength={20} />
              </Field>
              <Field label="Role" htmlFor="role" required errorFor="role">
                <select id="role" name="role" className="select" defaultValue={editing?.role ?? "MODERATOR"} disabled={!isSuperAdmin}>
                  <option value="SUPER_ADMIN">Super Admin — full control of the shop</option>
                  <option value="ADMIN">Admin — operations, staff below them</option>
                  <option value="MODERATOR">Moderator — support &amp; moderation</option>
                  <option value="CUSTOMER">Customer — no dashboard access</option>
                </select>
              </Field>
              <Field label="Status" htmlFor="status">
                <select id="status" name="status" className="select" defaultValue={editing?.status === "ACTIVE" || !editing ? "ACTIVE" : editing.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </Field>
              <Field
                label={editing ? "Reset password" : "Initial password"}
                htmlFor="password"
                required={!editing}
                errorFor="password"
                hint={editing ? "Leave blank to keep the current password." : "At least 8 characters with upper case, lower case and a number."}
              >
                <PasswordInput id="password" name="password" autoComplete="new-password" maxLength={200} />
              </Field>
              <Field label="Internal note" htmlFor="staffNote">
                <input id="staffNote" name="staffNote" className="input" defaultValue={editing?.staffNote ?? ""} maxLength={500} />
              </Field>
            </div>
            <div className="card-footer">
              <SubmitButton>{editing ? "Save staff member" : "Create staff member"}</SubmitButton>
            </div>
          </ActionForm>
        ) : null}
      </div>
    </>
  );
}
