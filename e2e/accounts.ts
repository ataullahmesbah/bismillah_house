import path from "node:path";

/**
 * Seeded sign-in credentials and where `auth.setup.ts` stores each role's
 * saved session. Kept out of the spec files so Playwright does not treat this
 * as a test file importing another test file.
 */
export const STORAGE_DIR = path.join(".playwright", "auth");

export const ACCOUNTS = {
  superAdmin: { email: "superadmin@trustmart.local", password: "SuperAdmin#2026" },
  moderator: { email: "moderator@trustmart.local", password: "Moderator#2026" },
  customer: { email: "customer@trustmart.local", password: "Customer#2026" },
} as const;

export type AccountName = keyof typeof ACCOUNTS;

export function storageStateFor(name: AccountName): string {
  return path.join(STORAGE_DIR, `${name}.json`);
}
