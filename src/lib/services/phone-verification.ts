import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db";
import { errors } from "@/lib/api";
import { sendSms } from "./sms";

/**
 * Mobile-number verification for checkout.
 *
 * Cash on delivery makes fake orders cheap: someone types any number, the
 * parcel ships, nobody pays. Confirming the number by SMS before the order is
 * accepted puts a real cost on that.
 *
 * Only the hash of each code is stored, so a database dump does not hand an
 * attacker live codes.
 */

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** A fresh code cannot be requested more often than this, per number. */
const RESEND_COOLDOWN_SECONDS = 60;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function matches(candidate: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(candidate), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type SendCodeResult = {
  sent: boolean;
  /** Seconds the caller must wait before asking again. */
  retryAfterSeconds: number;
  detail?: string;
};

export async function sendVerificationCode(
  phone: string,
  options: { shopName: string; ipAddress?: string | null } = { shopName: "Trust Mart" },
): Promise<SendCodeResult> {
  const recent = await prisma.phoneVerification.findFirst({
    where: { phone, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recent) {
    const elapsed = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
    return {
      sent: false,
      retryAfterSeconds: Math.max(1, RESEND_COOLDOWN_SECONDS - elapsed),
      detail: "A code was just sent. Please wait before requesting another.",
    };
  }

  // randomInt is drawn from a CSPRNG; Math.random would be guessable.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await prisma.phoneVerification.create({
    data: {
      phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      ipAddress: options.ipAddress ?? null,
    },
  });

  const result = await sendSms(
    phone,
    `${options.shopName}: your order verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. Do not share it with anyone.`,
  );

  return {
    sent: result.delivered,
    retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
    detail: result.delivered ? undefined : result.detail,
  };
}

/** Checks a code and, on success, marks the number verified. */
export async function verifyCode(phone: string, code: string): Promise<{ ok: boolean; reason?: string }> {
  const record = await prisma.phoneVerification.findFirst({
    where: { phone, consumedAt: null, verifiedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "That code has expired. Request a new one." };

  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "Too many incorrect attempts. Request a new code." };
  }

  if (!matches(code, record.codeHash)) {
    await prisma.phoneVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "That code is not correct." };
  }

  await prisma.phoneVerification.update({
    where: { id: record.id },
    data: { verifiedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Confirms the number carries a live verification and spends it, so one code
 * cannot be reused across several orders. Throws when the order must not
 * proceed — the caller treats that as a checkout failure.
 */
export async function consumeVerification(phone: string): Promise<void> {
  const record = await prisma.phoneVerification.findFirst({
    where: { phone, consumedAt: null, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
    orderBy: { verifiedAt: "desc" },
    select: { id: true },
  });

  if (!record) {
    throw errors.validation("Please verify your mobile number before placing the order.");
  }

  await prisma.phoneVerification.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
}

/** Whether this number already holds a verification ready to be spent. */
export async function hasLiveVerification(phone: string): Promise<boolean> {
  const count = await prisma.phoneVerification.count({
    where: { phone, consumedAt: null, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
  });
  return count > 0;
}
