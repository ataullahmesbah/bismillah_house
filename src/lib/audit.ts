import "server-only";

import { prisma } from "@/lib/db";
import { requestContext, type SessionUser } from "@/lib/auth/session";
import type { AuditSeverity } from "@/generated/prisma/enums";

/**
 * Audit trail for sensitive actions (PRD §29).
 *
 * Never pass passwords, tokens, payment secrets or full card/gateway payloads
 * in here — `redact()` strips the obvious ones as a second line of defence.
 */

const REDACTED_KEYS = [
  "password", "passwordhash", "confirmpassword", "token", "tokenhash", "secret",
  "apikey", "api_key", "appsecret", "app_secret", "authorization", "cookie",
  "storepassword", "credentials", "webhooksecret", "accesstoken",
];

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || depth > 6) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.includes(key.toLowerCase()) ? "[redacted]" : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

export type AuditInput = {
  actor?: SessionUser | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  before?: unknown;
  after?: unknown;
  severity?: AuditSeverity;
};

/** Writes an audit row. Failures are logged but never break the caller's flow. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const { ip, userAgent } = await requestContext();
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? "system",
        actorRole: input.actor?.role ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary?.slice(0, 500),
        before: input.before === undefined ? undefined : (redact(input.before) as object),
        after: input.after === undefined ? undefined : (redact(input.after) as object),
        ipAddress: ip,
        userAgent: userAgent?.slice(0, 400),
        severity: input.severity ?? "INFO",
      },
    });
  } catch (error) {
    console.error("[trust-mart] failed to write audit log", error);
  }
}

/** Security events that must be recorded even when there is no session. */
export async function recordSecurityEvent(
  action: string,
  summary: string,
  severity: AuditSeverity = "WARNING",
  meta?: Record<string, unknown>,
): Promise<void> {
  await recordAudit({ action, summary, severity, after: meta, entityType: "security" });
}

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILED: "auth.login.failed",
  LOGOUT: "auth.logout",
  REGISTER: "auth.register",
  PASSWORD_RESET_REQUEST: "auth.password_reset.request",
  PASSWORD_RESET_COMPLETE: "auth.password_reset.complete",
  PASSWORD_CHANGED: "auth.password.changed",
  ROLE_CHANGED: "user.role.changed",
  TOKEN_CREATED: "token.created",
  TOKEN_UPDATED: "token.updated",
  PRODUCT_PUBLISHED: "product.published",
  PRODUCT_SUBMITTED: "product.submitted",
  USER_STATUS_CHANGED: "user.status.changed",
  STAFF_CREATED: "staff.created",
  PERMISSION_CHANGED: "permission.changed",
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_DELETED: "product.archived",
  INVENTORY_ADJUSTED: "inventory.adjusted",
  ORDER_CREATED: "order.created",
  ORDER_STATUS_CHANGED: "order.status.changed",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_REFUNDED: "order.refunded",
  ORDER_NOTE_ADDED: "order.note.added",
  CUSTOMER_SEARCH: "order.customer_search",
  INVOICE_DOWNLOADED: "invoice.downloaded",
  PAYMENT_UPDATED: "payment.updated",
  COUPON_CREATED: "coupon.created",
  COUPON_UPDATED: "coupon.updated",
  OFFER_UPDATED: "offer.updated",
  BANNER_UPDATED: "banner.updated",
  REVIEW_MODERATED: "review.moderated",
  MESSAGE_DELETED: "message.deleted",
  SETTINGS_CHANGED: "settings.changed",
  SHIPPING_CHANGED: "shipping.changed",
  NAVIGATION_CHANGED: "navigation.changed",
  CONTENT_CHANGED: "content.changed",
  WAREHOUSE_CHANGED: "warehouse.changed",
  STOCK_RECEIVED: "inventory.received",
  COURIER_DISPATCHED: "courier.dispatched",
  COURIER_SYNCED: "courier.synced",
  COURIER_SETTLED: "courier.settled",
  FINANCE_CREATED: "finance.transaction.created",
  FINANCE_UPDATED: "finance.transaction.updated",
  FINANCE_VOIDED: "finance.transaction.voided",
  AI_DRAFT_CREATED: "ai.draft.created",
  AI_DRAFT_APPLIED: "ai.draft.applied",
} as const;
