import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken, randomToken } from "@/lib/ids";
import type { Role, UserStatus } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "tm_session";
export const CART_COOKIE = "tm_cart";

/** The minimal, safe projection of a user that server code passes around. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
};

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  avatarUrl: true,
} as const;

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? null;
  return { ip, userAgent: headerList.get("user-agent") };
}

/** Issues a new server-side session and sets the HttpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const maxAgeSeconds = env.sessionDays * 24 * 60 * 60;
  const { ip, userAgent } = await requestContext();

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ipAddress: ip,
      userAgent: userAgent?.slice(0, 400),
      expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(maxAgeSeconds));
}

/**
 * Resolves the signed-in user for the current request.
 * Wrapped in `cache()` so a page that checks auth in ten places still issues
 * exactly one query per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { ...USER_SELECT, deletedAt: true } },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user || session.user.deletedAt) return null;
  // Suspended and blocked accounts lose access immediately, mid-session.
  if (session.user.status !== "ACTIVE") return null;

  const { deletedAt: _deletedAt, ...user } = session.user;
  return user;
});

/** Signs the current user out and revokes the server-side session row. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}

/** Used after a password change, or by an admin suspending an account. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Reads (and lazily creates) the guest cart cookie token. */
export async function getCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function setCartToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, token, cookieOptions(60 * 60 * 24 * 30));
}

export async function clearCartToken(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}
