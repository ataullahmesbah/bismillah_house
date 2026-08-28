import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

/**
 * A single PrismaClient per process. Next.js hot-reloads modules in
 * development, so the instance is cached on globalThis to avoid exhausting
 * database connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  return new PrismaClient({
    adapter,
    log: env.isProduction ? ["error"] : ["error", "warn"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from "@/generated/prisma/client";

/**
 * Runs a query and falls back to a default when the database is unreachable.
 *
 * Used by shared chrome (navigation, banners, settings) and by content pages
 * that are prerendered at build time, so:
 *  - `next build` succeeds on a machine that has no database yet, and
 *  - a transient database blip degrades one section instead of returning a 500
 *    for the whole page (PRD §34).
 *
 * Never use it for order, payment or authorisation queries — those must fail
 * loudly rather than silently return an empty result.
 */
export async function safeQuery<T>(run: () => Promise<T>, fallback: T, context?: string): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[trust-mart] query unavailable${context ? ` (${context})` : ""}`, error);
    return fallback;
  }
}
