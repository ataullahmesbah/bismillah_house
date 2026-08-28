import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { PageHeader, StatusPill } from "@/components/ui";
import { saveUserPermissionsAction } from "@/app/actions/dashboard/people";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getEffectivePermissions } from "@/lib/auth/rbac";
import { PERMISSION_GROUPS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function StaffPermissionsPage({ params }: { params: Params }) {
  const { id } = await params;
  await requireSuperAdmin();

  const member = await prisma.user.findFirst({
    where: { id, role: { in: ["ADMIN", "MODERATOR"] }, deletedAt: null },
    select: {
      id: true, name: true, email: true, role: true, status: true, lastLoginAt: true,
      permissions: { select: { permission: true, allowed: true } },
    },
  });
  if (!member) notFound();

  const effective = await getEffectivePermissions(member.id, member.role);
  const allowSet = new Set(member.permissions.filter((row) => row.allowed).map((row) => row.permission));
  const denySet = new Set(member.permissions.filter((row) => !row.allowed).map((row) => row.permission));

  return (
    <>
      <PageHeader
        title={`Permissions — ${member.name}`}
        description={`${member.email} · ${member.role} · last sign-in ${member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "never"}`}
        action={
          <div className="flex gap-2">
            <StatusPill status={member.status} />
            <Link href="/dashboard/staff" className="btn-ghost btn-sm">← Staff</Link>
          </div>
        }
      />

      <div className="alert-neutral mb-4">
        <div>
          These overrides sit on top of the <Link href={`/dashboard/staff/roles?role=${member.role}`} className="link">{member.role.toLowerCase()} role</Link>.
          “Grant” adds a permission the role does not have; “Deny” removes one the role does have.
        </div>
      </div>

      <ActionForm action={saveUserPermissionsAction} className="stack">
        <input type="hidden" name="userId" value={member.id} />

        {PERMISSION_GROUPS.map((group) => (
          <section key={group.group} className="card">
            <div className="card-header"><h2 className="card-title">{group.group}</h2></div>
            <div className="table-wrap border-0">
              <table className="table table-compact">
                <thead>
                  <tr><th>Permission</th><th>From role</th><th className="text-center">Grant</th><th className="text-center">Deny</th><th>Effective</th></tr>
                </thead>
                <tbody>
                  {group.permissions.map((permission) => {
                    const hasEffective = effective.has(permission.key);
                    const fromRole = hasEffective && !allowSet.has(permission.key);
                    return (
                      <tr key={permission.key}>
                        <td>
                          <p className="font-medium">{permission.label}</p>
                          <p className="mono text-xs text-brand-400">{permission.key}</p>
                        </td>
                        <td>{fromRole ? <span className="badge-outline">Yes</span> : <span className="muted-xs">—</span>}</td>
                        <td className="text-center">
                          <input type="checkbox" name="allow" value={permission.key} className="checkbox" defaultChecked={allowSet.has(permission.key)} />
                        </td>
                        <td className="text-center">
                          <input type="checkbox" name="deny" value={permission.key} className="checkbox" defaultChecked={denySet.has(permission.key)} />
                        </td>
                        <td>
                          <span className={hasEffective ? "badge-green" : "badge-gray"}>{hasEffective ? "Allowed" : "Blocked"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <div className="card">
          <div className="card-footer">
            <SubmitButton>Save overrides</SubmitButton>
          </div>
        </div>
      </ActionForm>
    </>
  );
}
