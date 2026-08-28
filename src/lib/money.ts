/**
 * Money helpers.
 *
 * Every monetary value in the database is an integer in *minor units*
 * (poisha). 1 BDT = 100 poisha. Never do arithmetic on formatted strings and
 * never store floats.
 */

export const CURRENCY = "BDT";
export const CURRENCY_SYMBOL = "৳";
export const MINOR_UNITS = 100;

/** Convert a major-unit amount (৳ taka) to minor units. */
export function toMinor(amount: number | string): number {
  const value = typeof amount === "string" ? Number(amount.replace(/,/g, "")) : amount;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * MINOR_UNITS);
}

/** Convert minor units back to a major-unit number. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / MINOR_UNITS;
}

/** `12345` -> `৳123.45` (or `৳123` when the amount is whole). */
export function formatMoney(minor: number, options?: { withSymbol?: boolean; decimals?: 0 | 2 }): string {
  const withSymbol = options?.withSymbol ?? true;
  const value = fromMinor(minor);
  const decimals = options?.decimals ?? (Number.isInteger(value) ? 0 : 2);
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return withSymbol ? `${CURRENCY_SYMBOL}${formatted}` : formatted;
}

/** Percentage discount of a minor amount, rounded to the nearest poisha. */
export function percentOf(minor: number, percent: number): number {
  return Math.round((minor * percent) / 100);
}

/** Clamp a discount so it can never exceed the amount it applies to. */
export function clampDiscount(discount: number, base: number): number {
  return Math.max(0, Math.min(Math.round(discount), Math.round(base)));
}

/** Discount percentage between an original and a current price (for badges). */
export function discountPercent(original: number | null | undefined, current: number): number | null {
  if (!original || original <= current) return null;
  return Math.round(((original - current) / original) * 100);
}

/** Sum helper that keeps everything integral. */
export function sumMinor(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + Math.round(value ?? 0), 0);
}
