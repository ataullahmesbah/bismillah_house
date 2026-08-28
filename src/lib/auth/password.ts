import "server-only";

import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Plain-text passwords are never stored or logged. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Constant-ish work even when the account does not exist, so response timing
 * cannot be used to enumerate registered emails.
 */
export async function dummyCompare(): Promise<void> {
  await bcrypt.compare("not-a-real-password", "$2a$12$C6UzMDM.H6dfI/f/IKcEe.eS8/Zo3fT2eGiG7pC3wKQKQGqcFLYaG");
}

export function passwordStrengthIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push("Use at least 8 characters.");
  if (!/[a-z]/.test(password)) issues.push("Add a lowercase letter.");
  if (!/[A-Z]/.test(password)) issues.push("Add an uppercase letter.");
  if (!/[0-9]/.test(password)) issues.push("Add a number.");
  return issues;
}
