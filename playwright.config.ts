import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the critical customer and staff journeys (PRD §35).
 *
 * They run against a real server with a real database, so run migrations and
 * the seed first:  npm run db:reset && npm run db:seed
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Use a Chromium that is already on the machine when one is available
 * (CI images often preinstall it), instead of downloading another copy.
 * Set PLAYWRIGHT_CHROMIUM_PATH to point at your own binary.
 */
function findChromium(): string | undefined {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH
      ? fs
          .readdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
          .map((entry) => `${process.env.PLAYWRIGHT_BROWSERS_PATH}/${entry.name}/chrome-linux/chrome`)
      : []),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

const executablePath = findChromium();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Signs each seeded role in once and stores the cookies for reuse.
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], ...(executablePath ? { launchOptions: { executablePath } } : {}) },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], ...(executablePath ? { launchOptions: { executablePath } } : {}) },
    },
  ],
  // Reuse an already-running server when one is up (CI starts its own).
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
