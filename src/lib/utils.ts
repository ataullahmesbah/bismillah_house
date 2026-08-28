/** Small shared helpers used across server and client components. */

/** Join conditional class names — a dependency-free `clsx`. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * URL-safe slug that keeps Bengali (and any other script) intact.
 *
 * `\p{M}` matters: Bengali vowel signs and conjunct marks are combining
 * characters, so a letters-and-digits-only filter would shred them. NFC keeps
 * each grapheme composed rather than decomposing it first.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Ensure a slug is unique by appending -2, -3 … using a lookup callback. */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  let counter = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
    if (counter > 500) {
      candidate = `${root}-${Date.now()}`;
      break;
    }
  }
  return candidate;
}

const DATE_TZ = process.env.NEXT_PUBLIC_TIMEZONE ?? "Asia/Dhaka";

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: DATE_TZ,
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: DATE_TZ,
  }).format(new Date(value));
}

/** `2026-08-21T18:00` value for <input type="datetime-local"> in Asia/Dhaka. */
export function toDateTimeLocalValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DATE_TZ,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function relativeTime(value: Date | string): string {
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return formatter.format(diffSeconds, "second");
}

export function truncate(input: string, length = 140): string {
  if (input.length <= length) return input;
  return `${input.slice(0, length - 1).trimEnd()}…`;
}

/** Strip HTML so CMS content can be reused inside meta descriptions. */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Title-cases an ENUM_VALUE for display. */
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Mask a phone number for anyone without the "view customer contact" permission. */
export function maskPhone(phone: string): string {
  if (phone.length < 5) return "•••••";
  return `${phone.slice(0, 3)}••••${phone.slice(-3)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "•••";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - 2))}@${domain}`;
}

/** Only allow same-origin relative redirects — blocks open-redirect abuse. */
export function safeRedirectPath(input: string | null | undefined, fallback = "/"): string {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  return input;
}

/** External URLs stored by admins must be http(s) only. */
export function isSafeUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parsePositiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

/** Build a querystring while dropping empty values. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Cartesian product — used to generate variant combinations. */
export function cartesian<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>((acc, group) => acc.flatMap((combo) => group.map((item) => [...combo, item])), [[]]);
}

/**
 * Builds a wa.me link from whatever the shop typed into settings.
 *
 * Accepts a full WhatsApp URL, or a bare Bangladeshi number in any of the
 * forms people actually write — 01712345678, +8801712345678, 8801712345678,
 * with or without spaces and dashes. Returns null when there is nothing
 * usable, so the caller can simply not render the button.
 */
export function whatsappLink(value: string | null | undefined, message?: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const query = message ? `?text=${encodeURIComponent(message)}` : "";

  // Already a link — trust it, but only over https.
  if (/^https?:\/\//i.test(raw)) {
    return raw.startsWith("https://") ? raw : null;
  }

  const digits = raw.replace(/[^\d]/g, "");
  // 01XXXXXXXXX → 8801XXXXXXXXX
  if (/^01[3-9]\d{8}$/.test(digits)) return `https://wa.me/88${digits}${query}`;
  // Already carries the country code.
  if (/^8801[3-9]\d{8}$/.test(digits)) return `https://wa.me/${digits}${query}`;
  // Some other country's number, long enough to be real.
  if (digits.length >= 10 && digits.length <= 15) return `https://wa.me/${digits}${query}`;

  return null;
}


/**
 * How a staff reply is signed to a customer.
 *
 * Customers deal with the shop, not with individuals: showing a moderator's
 * personal name invites them to chase that person directly, and makes the
 * team look inconsistent when a colleague picks the thread up. Staff keep
 * seeing each other's real names inside the dashboard, so a rude or wrong
 * reply is still traceable to whoever wrote it.
 */
export function shopTeamName(shopName: string): string {
  const trimmed = shopName.trim();
  if (!trimmed) return "Support Team";
  return /team$/i.test(trimmed) ? trimmed : `${trimmed} Team`;
}
