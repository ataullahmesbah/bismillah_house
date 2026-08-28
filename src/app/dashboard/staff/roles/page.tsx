import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { PageHeader } from "@/components/ui";
import { saveRolePermissionsAction } from "@/app/actions/dashboard/people";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_GROUPS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RolePermissionsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const role = params.role === "MODERATOR" ? "MODERATOR" : "ADMIN";

  const granted = await prisma.rolePermission.findMany({
    where: { role, allowed: true },
    select: { permission: true },
  });
  const grantedSet = new Set(granted.map((row) => row.permission));
  const defaults = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role]);

  return (
    <>
      <PageHeader
        title="Role permissions"
        description="Decide exactly what each role can do. Changes apply immediately to every member of that role."
        action={<Link href="/dashboard/staff" className="btn-ghost btn-sm">← Staff</Link>}
      />

      <div className="toolbar">
        <Link href="/dashboard/staff/roles?role=ADMIN" className={role === "ADMIN" ? "chip chip-active" : "chip"}>Admin</Link>
        <Link href="/dashboard/staff/roles?role=MODERATOR" className={role === "MODERATOR" ? "chip chip-active" : "chip"}>Moderator</Link>
      </div>

      <div className="alert-neutral mb-4">
        <div>
          The Super Admin always holds every permission and cannot be restricted — that rule is enforced in the backend,
          not just here. Individual staff can also be given per-user overrides from their profile page.
        </div>
      </div>

      <ActionForm action={saveRolePermissionsAction} className="stack">
        <input type="hidden" name="role" value={role} />

        {PERMISSION_GROUPS.map((group) => (
          <section key={group.group} className="card">
            <div className="card-header"><h2 className="card-title">{group.group}</h2></div>
            <div className="card-body grid gap-2 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <label key={permission.key} className="check-row">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission.key}
                    className="checkbox mt-0.5"
                    defaultChecked={grantedSet.size > 0 ? grantedSet.has(permission.key) : defaults.has(permission.key)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{permission.label}</span>
                    <span className="mono block text-xs text-brand-400">{permission.key}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}

        <div className="card">
          <div className="card-footer">
            <p className="muted-xs mr-auto">Saving replaces the whole permission set for {role.toLowerCase()}s.</p>
            <SubmitButton>Save {role.toLowerCase()} permissions</SubmitButton>
          </div>
        </div>
      </ActionForm>
    </>
  );
}
