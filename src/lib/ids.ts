import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";

/** URL-safe random token (base64url). Used for sessions, carts and order tracking. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** One-way hash for anything token-like that we persist. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const NUMBER_ALPHABET = "0123456789";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += NUMBER_ALPHABET[randomInt(0, 10)];
  return out;
}

/** `TM-260821-4839` — sortable by date, non-sequential tail so it leaks no volume data. */
export function generateOrderNumber(now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `TM-${yy}${mm}${dd}-${randomDigits(4)}`;
}

/** `INV-2026-000123` — unique and immutable once issued. */
export function generateInvoiceNumber(sequence: number, now = new Date()): string {
  return `INV-${now.getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}

/**
 * `TXN-260827-4839` — a human-quotable reference for a financial or stock row.
 *
 * Date-prefixed so a row can be found by when it happened, with a random tail
 * rather than a counter: a sequential reference tells anyone who sees one how
 * many transactions the shop has posted.
 */
export function generateReference(prefix: string, now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${prefix}-${yy}${mm}${dd}-${randomDigits(4)}`;
}

/** Deterministic SKU suggestion, e.g. `PRD-DATES-1KG`. */
export function generateSku(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .map((part) => String(part).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8))
    .filter(Boolean)
    .join("-");
}
