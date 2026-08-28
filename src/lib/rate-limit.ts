import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { errors } from "@/lib/api";
import { requestContext } from "@/lib/auth/session";

/**
 * Durable fixed-window rate limiting.
 *
 * A per-instance memory cache absorbs the common case; the database row makes
 * the limit hold across serverless instances. Authentication, checkout,
 * coupon, contact, review and message endpoints all pass through here.
 */

type Window = { count: number; expiresAt: number };
const memory = new Map<string, Window>();

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 15 * 60 },
  // The per-IP budget is deliberately looser than the per-email one, and is
  // never reset on success: it exists to slow credential stuffing spread
  // across many accounts, not to cap one person's sign-ins. Most Bangladeshi
  // mobile ISPs place whole subscriber pools behind a single CGNAT address,
  // so a tight per-IP cap would lock out real customers who share it.
  loginIp: { limit: 40, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  checkout: { limit: 12, windowSeconds: 10 * 60 },
  // Each code costs money to send, so the ceiling is deliberately low.
  checkoutOtp: { limit: 6, windowSeconds: 15 * 60 },
  coupon: { limit: 20, windowSeconds: 10 * 60 },
  contact: { limit: 5, windowSeconds: 60 * 60 },
  review: { limit: 10, windowSeconds: 60 * 60 },
  message: { limit: 30, windowSeconds: 60 * 60 },
  chatbot: { limit: 20, windowSeconds: 10 * 60 },
  upload: { limit: 40, windowSeconds: 60 * 60 },
  search: { limit: 120, windowSeconds: 60 },
  // Couriers batch their callbacks and retry failures, so the ceiling is high
  // enough not to drop legitimate traffic while still bounding a flood.
  courierWebhook: { limit: 240, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

function sweepMemory(now: number): void {
  if (memory.size < 5000) return;
  for (const [key, window] of memory) {
    if (window.expiresAt <= now) memory.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function checkRateLimit(name: RateLimitName, identifier: string): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name];
  if (!env.rateLimit.enabled) {
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const key = `${name}:${identifier}`;
  sweepMemory(now);

  const cached = memory.get(key);
  if (cached && cached.expiresAt > now) {
    cached.count += 1;
    if (cached.count > rule.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((cached.expiresAt - now) / 1000),
      };
    }
  } else {
    memory.set(key, { count: 1, expiresAt: now + rule.windowSeconds * 1000 });
  }

  try {
    const expiresAt = new Date(now + rule.windowSeconds * 1000);
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.expiresAt <= new Date(now)) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
    }

    const updated = await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    if (updated.count > rule.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt.getTime() - now) / 1000)),
      };
    }
    return { allowed: true, remaining: rule.limit - updated.count, retryAfterSeconds: 0 };
  } catch (error) {
    // A rate-limit store failure must never take checkout down; the in-memory
    // window above still applies for this instance.
    console.error("[trust-mart] rate limit store unavailable", error);
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}

/** Throws a 429 AppError when the caller is over the limit. */
export async function enforceRateLimit(name: RateLimitName, identifier?: string): Promise<void> {
  const id = identifier ?? (await requestContext()).ip ?? "anonymous";
  const result = await checkRateLimit(name, id);
  if (!result.allowed) {
    throw errors.tooMany(
      `Too many attempts. Please try again in ${Math.ceil(result.retryAfterSeconds / 60)} minute(s).`,
    );
  }
}

/** Clears counters for a key after a successful sensitive action (e.g. login). */
export async function resetRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  const key = `${name}:${identifier}`;
  memory.delete(key);
  await prisma.rateLimit.deleteMany({ where: { key } }).catch(() => undefined);
}
