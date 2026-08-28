import "server-only";

import { redirect } from "next/navigation";

import { errors } from "@/lib/api";
import { isStaffRole, type Permission } from "@/lib/constants";
import { getCurrentUser, type SessionUser } from "./session";
import { userHasAnyPermission, userHasPermission } from "./rbac";

/**
 * Server-side guards. Every dashboard page, server action and API route calls
 * one of these — UI visibility is never treated as authorisation.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaffRole(user.role)) throw errors.forbidden();
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") throw errors.forbidden("Super Admin access is required.");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireStaff();
  if (!(await userHasPermission(user, permission))) {
    throw errors.forbidden();
  }
  return user;
}

export async function requireAnyPermission(permissions: Permission[]): Promise<SessionUser> {
  const user = await requireStaff();
  if (!(await userHasAnyPermission(user, permissions))) {
    throw errors.forbidden();
  }
  return user;
}

/** Page-level variants that send the visitor somewhere useful instead of throwing. */
export async function requireUserPage(redirectTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  return user;
}

export async function requireStaffPage(redirectTo = "/dashboard"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  if (!isStaffRole(user.role)) redirect("/account");
  return user;
}

export async function requirePermissionPage(permission: Permission, redirectTo = "/dashboard"): Promise<SessionUser> {
  const user = await requireStaffPage(redirectTo);
  if (!(await userHasPermission(user, permission))) redirect("/dashboard?denied=1");
  return user;
}

/**
 * Page guard for a screen several permissions can open.
 *
 * Inventory is the case that needs it: a moderator may look at stock levels
 * with `inventory.view` while only a manager may move stock, and both land on
 * the same page.
 */
export async function requireAnyPermissionPage(
  permissions: Permission[],
  redirectTo = "/dashboard",
): Promise<SessionUser> {
  const user = await requireStaffPage(redirectTo);
  if (!(await userHasAnyPermission(user, permissions))) redirect("/dashboard?denied=1");
  return user;
}

/**
 * Ownership check that closes IDOR/BOLA holes: staff with the right permission
 * may read anything, a customer only their own records.
 */
export async function assertOwnershipOrPermission(
  user: SessionUser,
  ownerId: string | null | undefined,
  permission: Permission,
): Promise<void> {
  if (ownerId && ownerId === user.id) return;
  if (isStaffRole(user.role) && (await userHasPermission(user, permission))) return;
  throw errors.forbidden();
}
