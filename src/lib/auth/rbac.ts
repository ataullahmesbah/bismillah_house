import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { ALL_PERMISSIONS, isStaffRole, type Permission } from "@/lib/constants";
import type { Role } from "@/generated/prisma/enums";
import type { SessionUser } from "./session";

/**
 * Effective permissions = role grants (editable by the Super Admin)
 * overlaid with per-user allow/deny overrides.
 *
 * SUPER_ADMIN always holds every permission and can never be reduced — that
 * protection lives here in the backend, not in the UI.
 */
export const getEffectivePermissions = cache(async (userId: string, role: Role): Promise<Set<Permission>> => {
  if (role === "SUPER_ADMIN") return new Set(ALL_PERMISSIONS);
  if (!isStaffRole(role)) return new Set();

  const [rolePerms, userPerms] = await Promise.all([
    prisma.rolePermission.findMany({ where: { role }, select: { permission: true, allowed: true } }),
    prisma.userPermission.findMany({ where: { userId }, select: { permission: true, allowed: true } }),
  ]);

  const effective = new Set<Permission>();
  for (const row of rolePerms) {
    if (row.allowed) effective.add(row.permission as Permission);
  }
  for (const row of userPerms) {
    if (row.allowed) effective.add(row.permission as Permission);
    else effective.delete(row.permission as Permission);
  }
  return effective;
});

export async function userHasPermission(user: SessionUser, permission: Permission): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const permissions = await getEffectivePermissions(user.id, user.role);
  return permissions.has(permission);
}

export async function userHasAnyPermission(user: SessionUser, permissions: Permission[]): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const effective = await getEffectivePermissions(user.id, user.role);
  return permissions.some((permission) => effective.has(permission));
}

/**
 * Super Admin protection (PRD §20/§41): nobody except a Super Admin may touch
 * a Super Admin account, and no role may ever be elevated to SUPER_ADMIN
 * through the staff editor.
 */
/**
 * Who may act on whose account.
 *
 * The chain of command, and the reason for each step:
 *  - Nobody edits their own privileges, whatever their role. Otherwise the
 *    weakest account on the team is one form submission from owning the shop.
 *  - A Super Admin manages everyone, including other Super Admins — a shop
 *    with two owners needs one to be able to remove the other's access when
 *    they leave. The "last remaining Super Admin" guard lives in the action,
 *    because it needs to count rows.
 *  - An Admin manages moderators and customers, never another Admin and never
 *    a Super Admin: sideways and upward moves belong to the owner.
 *  - A Moderator manages customers only. That is the support desk.
 */
const MANAGEABLE_BY: Record<Role, Role[]> = {
  SUPER_ADMIN: ["SUPER_ADMIN", "ADMIN", "MODERATOR", "CUSTOMER"],
  ADMIN: ["MODERATOR", "CUSTOMER"],
  MODERATOR: ["CUSTOMER"],
  CUSTOMER: [],
};

export function canManageUser(actor: SessionUser, targetRole: Role, targetId: string): boolean {
  if (actor.id === targetId) return false;
  return MANAGEABLE_BY[actor.role].includes(targetRole);
}

/**
 * Who may hand out which role.
 *
 * Changing a role is a different power from suspending an account, so it is a
 * separate check: an Admin can stop a moderator working, but only the owner
 * decides who *becomes* a moderator or an admin. A Super Admin can promote all
 * the way to Super Admin — hiring a co-owner is a real thing a shop does, and
 * the alternative is editing the database by hand.
 */
export function canAssignRole(actor: SessionUser, nextRole: Role): boolean {
  if (actor.role !== "SUPER_ADMIN") return false;
  return (["SUPER_ADMIN", "ADMIN", "MODERATOR", "CUSTOMER"] as Role[]).includes(nextRole);
}

/**
 * True when this actor must explain a status change.
 *
 * A moderator suspending a customer is the action most open to abuse and the
 * hardest to review later, so it carries a mandatory reason. Owners and admins
 * are trusted without one.
 */
export function requiresStatusNote(actor: SessionUser): boolean {
  return actor.role === "MODERATOR";
}
