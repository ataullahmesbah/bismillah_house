import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  exchangeCodeForProfile, GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE, isGoogleSignInActive,
} from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS, recordAudit, recordSecurityEvent } from "@/lib/audit";
import { isStaffRole } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { safeRedirectPath } from "@/lib/utils";

function failure(request: NextRequest, reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
}

/**
 * Completes Google sign-in.
 *
 * Everything here is checked before a session is issued: the state must match
 * the cookie set when the flow started, and Google must report the address as
 * verified — an unverified one would let someone claim an account by signing
 * up to Google with an address they do not control.
 */
export async function GET(request: NextRequest) {
  if (!(await isGoogleSignInActive())) return failure(request, "google-unavailable");

  const jar = await cookies();
  const expectedState = jar.get(GOOGLE_STATE_COOKIE)?.value;
  const verifier = jar.get(GOOGLE_VERIFIER_COOKIE)?.value;

  jar.delete(GOOGLE_STATE_COOKIE);
  jar.delete(GOOGLE_VERIFIER_COOKIE);

  const code = request.nextUrl.searchParams.get("code");
  const rawState = request.nextUrl.searchParams.get("state") ?? "";
  const [state, next] = rawState.split("|");

  if (!code || !verifier || !expectedState || state !== expectedState) {
    await recordSecurityEvent(AUDIT_ACTIONS.LOGIN_FAILED, "Google sign-in state mismatch", "WARNING");
    return failure(request, "google-state");
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile(code, verifier);
  } catch (error) {
    console.error("[trust-mart] Google sign-in failed:", error);
    return failure(request, "google-failed");
  }

  if (!profile.emailVerified) return failure(request, "google-unverified");

  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
    select: { id: true, name: true, email: true, role: true, status: true, deletedAt: true, googleId: true },
  });

  if (existing?.deletedAt) return failure(request, "account-unavailable");
  if (existing && (existing.status === "SUSPENDED" || existing.status === "BLOCKED")) {
    return failure(request, "account-inactive");
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        // Links Google to an account that already signed up with a password,
        // and records the address as verified now that Google vouches for it.
        data: {
          googleId: existing.googleId ?? profile.sub,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          avatarUrl: profile.picture ?? undefined,
        },
        select: { id: true, name: true, email: true, role: true, status: true },
      })
    : await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          googleId: profile.sub,
          // No password: this account signs in through Google only, until the
          // owner sets one from their security page.
          passwordHash: null,
          emailVerifiedAt: new Date(),
          avatarUrl: profile.picture,
          // Public sign-up is always a customer, exactly as the form is.
          role: "CUSTOMER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
        select: { id: true, name: true, email: true, role: true, status: true },
      });

  await createSession(user.id);

  await recordAudit({
    actor: { id: user.id, name: user.name, email: user.email, phone: null, role: user.role, status: user.status, avatarUrl: null },
    action: existing ? AUDIT_ACTIONS.LOGIN_SUCCESS : AUDIT_ACTIONS.REGISTER,
    entityType: "user",
    entityId: user.id,
    summary: `${user.email} signed in with Google`,
  });

  const destination = safeRedirectPath(next, isStaffRole(user.role) ? "/dashboard" : "/account");
  return NextResponse.redirect(new URL(destination, request.url));
}
