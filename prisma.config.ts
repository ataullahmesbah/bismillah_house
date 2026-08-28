import fs from "node:fs";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env files. Load them here so that
// `prisma migrate`, `prisma generate` and `prisma db seed` see DATABASE_URL.
for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (fs.existsSync(full)) {
    process.loadEnvFile(full);
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    /*
     * `prisma generate` only reads the schema — it never opens a connection —
     * so requiring DATABASE_URL here would make `npm install` fail on a fresh
     * clone, before anyone has had the chance to write a .env. The commands
     * that do need a database (migrate, deploy, studio, seed) still fail with
     * Prisma's own clear message when the URL is missing.
     */
    url: process.env.DATABASE_URL ? env("DATABASE_URL") : "",
  },
});
