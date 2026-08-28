"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { emailSchema, nameSchema, passwordSchema, phoneSchema, formDataToObject, formDataList } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requirePermission, requireSuperAdmin } from "@/lib/auth/guards";
import { canAssignRole, canManageUser, requiresStatusNote } from "@/lib/auth/rbac";
import type { Role } from "@/generated/prisma/enums";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/constants";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";

/**
 * Staff, roles and customer administration.
 *
 * Enforced here in the backend, never by which controls a page rendered:
 *  - only a Super Admin may change anyone's role, up to and including
 *    promoting someone to Super Admin;
 *  - an Admin may suspend or restore moderators and customers, but not change
 *    roles and not touch another Admin or the owner;
 *  - a Moderator may suspend or restore customers only, and must say why;
 *  - the last remaining Super Admin cannot be demoted or locked out, or the
 *    shop would have no one able to administer it;
 *  - nobody changes their own role or status;
 *  - every privileged change is audited.
 */

/**
 * Refuses a change that would leave the shop with no usable owner.
 *
 * Counted at the moment of the change rather than trusted from the form,
 * because two admins acting at once could otherwise each remove "the other"
 * Super Admin and lock everybody out.
 */
async function assertNotLastSuperAdmin(targetId: string, nextRole: Role, nextStatus: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { role: true, status: true },
  });
  if (!target || target.role !== "SUPER_ADMIN") return;

  const stillOwner = nextRole === "SUPER_ADMIN" && nextStatus === "ACTIVE";
  if (stillOwner) return;

  const remaining = await prisma.user.count({
    where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, NOT: { id: targetId } },
  });

  if (remaining === 0) {
    throw errors.validation(
      "This is the only active Super Admin. Promote someone else first, or the shop would be left with no owner.",
    );
  }
}

const staffSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MODERATOR", "CUSTOMER"]),
  password: passwordSchema.optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED"]).default("ACTIVE"),
  staffNote: z.string().max(500).optional(),
});

export async function saveStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission(PERMISSIONS.STAFF_MANAGE);
    const id = String(formData.get("id") ?? "");
    const raw = formDataToObject(formData);
    const input = staffSchema.parse(raw);

    if (!canAssignRole(actor, input.role)) {
      throw errors.forbidden("Only a Super Admin can assign staff roles.");
    }

    if (id) {
      const target = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, email: true, name: true, status: true },
      });
      if (!target) throw errors.notFound("Staff member not found.");
      if (!canManageUser(actor, target.role, target.id)) {
        throw errors.forbidden("This account cannot be modified.");
      }

      await assertNotLastSuperAdmin(target.id, input.role, input.status);

      const updated = await prisma.user.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone,
          role: input.role,
          status: input.status,
          staffNote: input.staffNote,
          ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
        },
        select: { id: true, email: true, role: true, status: true },
      });

      // Losing access must take effect immediately, not at next sign-in.
      if (input.status !== "ACTIVE" || target.role !== input.role || input.password) {
        await revokeAllSessions(id);
      }

      await recordAudit({
        actor,
        action: target.role !== input.role ? AUDIT_ACTIONS.ROLE_CHANGED : AUDIT_ACTIONS.USER_STATUS_CHANGED,
        entityType: "user",
        entityId: id,
        summary: `Updated staff ${updated.email} (${target.role} → ${input.role}, ${target.status} → ${input.status})`,
        before: { role: target.role, status: target.status },
        after: { role: input.role, status: input.status },
        severity: "WARNING",
      });

      revalidatePath("/dashboard/staff");
      return actionSuccess("Staff member updated.");
    }

    if (!input.password) {
      throw errors.validation("Set an initial password for the new staff member.", { password: "Password required." });
    }

    const [emailTaken, phoneTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } }),
    ]);
    if (emailTaken) throw errors.validation("That email is already registered.", { email: "Already in use." });
    if (phoneTaken) throw errors.validation("That mobile number is already registered.", { phone: "Already in use." });

    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        status: input.status,
        staffNote: input.staffNote,
        passwordHash: await hashPassword(input.password),
      },
      select: { id: true, email: true },
    });

    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.STAFF_CREATED,
      entityType: "user",
      entityId: created.id,
      summary: `Created ${input.role} account ${created.email}`,
      severity: "WARNING",
    });

    revalidatePath("/dashboard/staff");
    return actionSuccess("Staff member created.");
  } catch (error) {
    return actionFailure(error, "saveStaff");
  }
}

export async function setUserStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission(PERMISSIONS.CUSTOMER_UPDATE);
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!["ACTIVE", "SUSPENDED", "BLOCKED"].includes(status)) throw errors.validation("Invalid status.");

    const reason = String(formData.get("reason") ?? "").trim();

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, email: true, status: true, staffNote: true },
    });
    if (!target) throw errors.notFound("User not found.");
    if (!canManageUser(actor, target.role, target.id)) {
      throw errors.forbidden("This account cannot be modified.");
    }

    /*
     * A moderator suspending a customer is the action most open to abuse and
     * the hardest to review months later, so it has to carry a reason. The
     * reason is stored on the account and repeated in the audit entry, so it
     * survives even if the note is edited afterwards.
     */
    if (requiresStatusNote(actor) && reason.length < 5) {
      throw errors.validation("Say why you are changing this account's status.", {
        reason: "A short reason is required.",
      });
    }

    await assertNotLastSuperAdmin(target.id, target.role, status);

    await prisma.user.update({
      where: { id },
      data: {
        status: status as "ACTIVE" | "SUSPENDED" | "BLOCKED",
        ...(reason
          ? { staffNote: `${new Date().toISOString().slice(0, 10)} · ${actor.name}: ${reason}` }
          : {}),
      },
    });
    if (status !== "ACTIVE") await revokeAllSessions(id);

    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
      entityType: "user",
      entityId: id,
      summary: `${target.email}: ${target.status} → ${status}${reason ? ` — ${reason}` : ""}`,
      before: { status: target.status, staffNote: target.staffNote },
      after: { status, reason: reason || null },
      severity: "WARNING",
    });

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/staff");
    return actionSuccess("Account status updated.");
  } catch (error) {
    return actionFailure(error, "setUserStatus");
  }
}

/** Role → permission grants. Super Admin only, and SUPER_ADMIN itself is not editable. */
export async function saveRolePermissionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireSuperAdmin();
    const role = String(formData.get("role") ?? "");
    if (role !== "ADMIN" && role !== "MODERATOR") {
      throw errors.forbidden("Only the Admin and Moderator roles are configurable.");
    }

    const granted = formDataList(formData, "permissions").filter((permission) =>
      (ALL_PERMISSIONS as string[]).includes(permission),
    );

    const before = await prisma.rolePermission.findMany({
      where: { role },
      select: { permission: true, allowed: true },
    });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role } }),
      prisma.rolePermission.createMany({
        data: granted.map((permission) => ({ role, permission, allowed: true })),
        skipDuplicates: true,
      }),
    ]);

    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.PERMISSION_CHANGED,
      entityType: "role",
      entityId: role,
      summary: `Updated ${role} permissions (${granted.length} granted)`,
      before: { permissions: before.filter((row) => row.allowed).map((row) => row.permission) },
      after: { permissions: granted },
      severity: "CRITICAL",
    });

    revalidatePath("/dashboard/staff/roles");
    return actionSuccess("Role permissions updated.");
  } catch (error) {
    return actionFailure(error, "saveRolePermissions");
  }
}

/** Per-user overrides on top of their role. */
export async function saveUserPermissionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireSuperAdmin();
    const userId = String(formData.get("userId") ?? "");

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
    if (!target) throw errors.notFound("User not found.");
    if (target.role === "SUPER_ADMIN") throw errors.forbidden("Super Admin permissions cannot be reduced.");

    const allow = formDataList(formData, "allow").filter((p) => (ALL_PERMISSIONS as string[]).includes(p));
    const deny = formDataList(formData, "deny").filter((p) => (ALL_PERMISSIONS as string[]).includes(p));

    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId } }),
      prisma.userPermission.createMany({
        data: [
          ...allow.map((permission) => ({ userId, permission, allowed: true })),
          ...deny.map((permission) => ({ userId, permission, allowed: false })),
        ],
        skipDuplicates: true,
      }),
    ]);

    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.PERMISSION_CHANGED,
      entityType: "user",
      entityId: userId,
      summary: `Overrides for ${target.email}: +${allow.length} / -${deny.length}`,
      severity: "CRITICAL",
    });

    revalidatePath(`/dashboard/staff/${userId}`);
    return actionSuccess("Permission overrides saved.");
  } catch (error) {
    return actionFailure(error, "saveUserPermissions");
  }
}
