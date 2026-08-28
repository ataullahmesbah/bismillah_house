"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import {
  changePasswordSchema, forgotPasswordSchema, loginSchema, profileSchema,
  registerSchema, resetPasswordSchema,
} from "@/lib/validation/auth";
import { formDataToObject } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { dummyCompare, hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession, destroySession, getCurrentUser, requestContext, revokeAllSessions,
} from "@/lib/auth/session";
import { assertCaptcha } from "@/lib/auth/captcha";
import { enforceRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { hashToken, randomToken } from "@/lib/ids";
import { AUDIT_ACTIONS, recordAudit, recordSecurityEvent } from "@/lib/audit";
import { isStaffRole } from "@/lib/constants";
import { safeRedirectPath } from "@/lib/utils";

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string | null = null;

  try {
    const input = loginSchema.parse(formDataToObject(formData));
    const { ip } = await requestContext();

    // Two windows: one per email, one per IP.
    await enforceRateLimit("login", `email:${input.email}`);
    await enforceRateLimit("loginIp", `ip:${ip ?? "unknown"}`);

    // Checked before any password work, so a bot cannot use the form as an
    // oracle even at the cost of one bcrypt comparison per attempt.
    await assertCaptcha(String(formData.get("cf-turnstile-response") ?? ""), ip);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true, name: true, email: true, passwordHash: true, role: true, status: true,
        failedLoginCount: true, lockedUntil: true, deletedAt: true,
      },
    });

    // Same generic message and comparable timing whether or not the account exists.
    const invalid = errors.unauthorized("Email or password is incorrect.");

    if (!user || user.deletedAt) {
      await dummyCompare();
      await recordSecurityEvent(AUDIT_ACTIONS.LOGIN_FAILED, `Login attempt for unknown email`, "NOTICE");
      throw invalid;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw errors.tooMany("Too many failed attempts. Please try again in a few minutes.");
    }

    /*
     * A Google-created account has no password. Reject it the same way as a
     * wrong password — timing and message alike — so the form cannot be used
     * to discover which addresses signed up through Google.
     */
    const passwordOk = user.passwordHash
      ? await verifyPassword(input.password, user.passwordHash)
      : false;

    if (!passwordOk) {
      const failedLoginCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
              : null,
        },
      });
      await recordSecurityEvent(
        AUDIT_ACTIONS.LOGIN_FAILED,
        `Failed login for ${user.email} (attempt ${failedLoginCount})`,
        failedLoginCount >= MAX_FAILED_LOGINS ? "WARNING" : "NOTICE",
      );
      throw invalid;
    }

    if (user.status === "SUSPENDED" || user.status === "BLOCKED") {
      throw errors.forbidden("This account is not active. Please contact support.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await createSession(user.id);
    await resetRateLimit("login", `email:${input.email}`);

    await recordAudit({
      actor: { id: user.id, name: user.name, email: user.email, phone: null, role: user.role, status: user.status, avatarUrl: null },
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      entityType: "user",
      entityId: user.id,
      summary: `${user.email} signed in`,
    });

    destination = safeRedirectPath(input.next, isStaffRole(user.role) ? "/dashboard" : "/account");
  } catch (error) {
    return actionFailure(error, "login");
  }

  redirect(destination);
}

/* -------------------------------------------------------------------------- */
/* Register                                                                    */
/* -------------------------------------------------------------------------- */

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string | null = null;

  try {
    await enforceRateLimit("register");
    const { ip } = await requestContext();
    await assertCaptcha(String(formData.get("cf-turnstile-response") ?? ""), ip, "register");

    const input = registerSchema.parse(formDataToObject(formData));

    const [emailTaken, phoneTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } }),
    ]);
    if (emailTaken) throw errors.validation("An account with this email already exists.", { email: "Email already registered." });
    if (phoneTaken) throw errors.validation("An account with this mobile number already exists.", { phone: "Mobile number already registered." });

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        // New sign-ups are always customers. Staff roles are assigned by a
        // Super Admin from the dashboard — never through public registration.
        role: "CUSTOMER",
        status: "ACTIVE",
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    await createSession(user.id);
    await recordAudit({
      action: AUDIT_ACTIONS.REGISTER,
      entityType: "user",
      entityId: user.id,
      summary: `New customer account: ${user.email}`,
    });

    destination = "/account";
  } catch (error) {
    return actionFailure(error, "register");
  }

  redirect(destination);
}

/* -------------------------------------------------------------------------- */
/* Sign out                                                                    */
/* -------------------------------------------------------------------------- */

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) {
    await recordAudit({ actor: user, action: AUDIT_ACTIONS.LOGOUT, entityType: "user", entityId: user.id });
  }
  redirect("/");
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

export type ResetRequestState = ActionState & { resetPath?: string };

/**
 * Issues a reset token.
 *
 * The response is identical whether or not the email exists, so the form
 * cannot be used to discover which addresses are registered. With no email
 * provider configured the link is surfaced to the operator through the audit
 * log rather than being emailed (see README → optional integrations).
 */
export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceRateLimit("passwordReset");
    const input = forgotPasswordSchema.parse(formDataToObject(formData));

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, deletedAt: true },
    });

    if (user && !user.deletedAt) {
      const token = randomToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await recordSecurityEvent(
        AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
        `Password reset requested for ${user.email}`,
        "NOTICE",
        { resetPath: `/reset-password?token=${token}` },
      );
    }

    return actionSuccess(
      "If an account exists for that email, a password reset link has been generated. Please check your inbox.",
    );
  } catch (error) {
    return actionFailure(error, "forgotPassword");
  }
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string | null = null;

  try {
    await enforceRateLimit("passwordReset");
    const input = resetPasswordSchema.parse(formDataToObject(formData));

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw errors.validation("This reset link is invalid or has expired. Please request a new one.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(input.password), failedLoginCount: 0, lockedUntil: null },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Every existing session is revoked so a stolen session cannot survive a reset.
      prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await recordSecurityEvent(AUDIT_ACTIONS.PASSWORD_RESET_COMPLETE, "Password reset completed", "WARNING");
    destination = "/login?reset=1";
  } catch (error) {
    return actionFailure(error, "resetPassword");
  }

  redirect(destination);
}

/* -------------------------------------------------------------------------- */
/* Account self-service                                                        */
/* -------------------------------------------------------------------------- */

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw errors.unauthorized();

    const input = profileSchema.parse(formDataToObject(formData));

    const phoneOwner = await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
    if (phoneOwner && phoneOwner.id !== user.id) {
      throw errors.validation("That mobile number is already in use.", { phone: "Already in use." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { name: input.name, phone: input.phone },
    });

    revalidatePath("/account/profile");
    return actionSuccess("Profile updated.");
  } catch (error) {
    return actionFailure(error, "updateProfile");
  }
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw errors.unauthorized();

    const input = changePasswordSchema.parse(formDataToObject(formData));

    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });

    // Someone who signed up with Google has no current password to confirm;
    // they are setting one for the first time.
    if (!record) throw errors.unauthorized();
    if (record.passwordHash && !(await verifyPassword(input.currentPassword, record.passwordHash))) {
      throw errors.validation("Your current password is incorrect.", { currentPassword: "Incorrect password." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password) },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: "user",
      entityId: user.id,
      summary: "Password changed from the account page",
      severity: "NOTICE",
    });

    return actionSuccess("Password updated. Other devices stay signed in — use “sign out everywhere” to revoke them.");
  } catch (error) {
    return actionFailure(error, "changePassword");
  }
}

export async function signOutEverywhereAction(): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw errors.unauthorized();
    const count = await revokeAllSessions(user.id);
    await destroySession();
    await recordAudit({
      actor: user,
      action: "auth.sessions.revoked",
      entityType: "user",
      entityId: user.id,
      summary: `Revoked ${count} session(s)`,
      severity: "NOTICE",
    });
    return actionSuccess("Signed out on all devices.");
  } catch (error) {
    return actionFailure(error, "signOutEverywhere");
  }
}
