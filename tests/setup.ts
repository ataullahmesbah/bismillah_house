import fs from "node:fs";
import path from "node:path";

// Load .env so modules that read DATABASE_URL at import time can be required.
for (const file of [".env.test", ".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/trustmart?schema=public";
process.env.AUTH_SECRET ??= "test-secret";
