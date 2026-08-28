import { z } from "zod";

/** Shared primitives. Every external input is parsed through one of these. */

export const idSchema = z.string().min(1).max(64);

/**
 * A reference to another record that may be absent: an empty string, null, or a
 * missing form field all resolve to null.
 */
export const optionalIdSchema = z
  .union([idSchema, z.literal(""), z.null(), z.undefined()])
  .optional()
  .transform((value) => (value ? String(value) : null));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Enter a valid email address.")
  .max(160)
  .email("Enter a valid email address.");

/** Bangladeshi mobile numbers, stored normalised as 01XXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, "").replace(/^\+?880/, "0"))
  .pipe(z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)."));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const nameSchema = z.string().trim().min(2, "Enter your full name.").max(120);

/** Email that may be left blank or omitted entirely. */
export const optionalEmailSchema = z
  .union([emailSchema, z.literal(""), z.null(), z.undefined()])
  .optional()
  .transform((value) => (value ? String(value) : null));

/** Phone that may be left blank or omitted entirely. */
export const optionalPhoneSchema = z
  .union([phoneSchema, z.literal(""), z.null(), z.undefined()])
  .optional()
  .transform((value) => (value ? String(value) : null));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(140)
  .regex(
    /^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u,
    "Use lowercase letters, numbers and dashes only.",
  );

/**
 * Slug field on a create/edit form: an empty input means "generate one from the
 * name", so it must resolve to undefined rather than failing validation.
 */
export const optionalSlugSchema = z
  .union([slugSchema, z.literal(""), z.null(), z.undefined()])
  .optional()
  .transform((value) => (value ? String(value) : undefined));

/** Money entered in the dashboard as taka; stored as minor units. */
export const moneyInputSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const num = typeof value === "string" ? Number(value.replace(/,/g, "").trim() || "0") : value;
    return Number.isFinite(num) ? Math.round(num * 100) : Number.NaN;
  })
  .pipe(z.number().int("Enter a valid amount.").min(0, "Amount cannot be negative.").max(1_000_000_00_00));

export const optionalMoneySchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "string" ? Number(value.replace(/,/g, "").trim()) : value;
    return Number.isFinite(num) ? Math.round(num * 100) : null;
  })
  .pipe(z.number().int().min(0).max(1_000_000_00_00).nullable());

export const quantitySchema = z.coerce.number().int().min(1, "Quantity must be at least 1.").max(999);

export const stockSchema = z.coerce.number().int().min(0).max(1_000_000);

export const booleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === "true" || value === "on" || value === "1");

/**
 * An optional free-text field.
 *
 * `.optional()` matters as much as the `undefined` member of the union: in Zod
 * a *missing* object key is rejected unless the schema is optional, even when
 * the schema would accept `undefined` as a value. Conditionally rendered inputs
 * (a bKash reference that only appears for bKash orders, say) are simply absent
 * from the FormData, so without this every such form would fail validation.
 */
export const optionalText = (max = 500) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      const trimmed = typeof value === "string" ? value.trim() : "";
      return trimmed.length ? trimmed.slice(0, max) : null;
    });

export const requiredText = (label: string, max = 500) =>
  z.string().trim().min(1, `${label} is required.`).max(max);

/** Admin-supplied URLs: relative paths or http(s) only — blocks javascript: URLs. */
export const urlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      if (value === "") return true;
      if (value.startsWith("/")) return !value.startsWith("//");
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a valid http(s) URL or a path starting with /." },
  );

export const optionalUrlSchema = z
  .union([urlSchema, z.literal(""), z.null(), z.undefined()])
  .optional()
  .transform((value) => (value ? String(value) : null));

/** `datetime-local` inputs are interpreted in the shop timezone. */
export const dateTimeSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((date) => !Number.isNaN(date.getTime()), { message: "Enter a valid date and time." });

export const optionalDateTimeSchema = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

/** Reads a FormData object into a plain record Zod can parse. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.endsWith("[]")) {
      const cleanKey = key.slice(0, -2);
      const existing = output[cleanKey];
      if (Array.isArray(existing)) existing.push(value);
      else output[cleanKey] = [value];
      continue;
    }
    if (key in output) {
      const existing = output[key];
      if (Array.isArray(existing)) existing.push(value);
      else output[key] = [existing, value];
      continue;
    }
    output[key] = value;
  }
  return output;
}

/** Reads a repeated multi-select / checkbox group as a string array. */
export function formDataList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}
