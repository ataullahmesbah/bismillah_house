import { expect, test } from "@playwright/test";

import { storageStateFor } from "./accounts";

/**
 * A download URL is an API.
 *
 * These check the export routes refuse the people who should not have them,
 * rather than relying on the button being hidden — and that what a permitted
 * role gets back is narrowed to what they are allowed to see.
 *
 * Every request is made by `fetch` **inside the page**, not through
 * Playwright's `request` fixture or `page.request`. Both of those are Node-side
 * HTTP clients with their own cookie handling, and neither sends the session
 * cookie to `127.0.0.1` — the cookie is marked `Secure`, and their
 * trustworthy-origin rules differ from the browser's. Every role then arrives
 * signed out, gets 401, and each test silently measures the anonymous case
 * instead of its own.
 *
 * An in-page fetch uses the browser's own cookie jar, which is also what a real
 * download does.
 */

type Fetched = {
  status: number;
  contentType: string;
  body: string;
  /**
   * The first three bytes, before any decoding.
   *
   * `Response.text()` decodes as UTF-8 and strips a byte-order mark on the
   * way, so the BOM is invisible to it even when it is on the wire. Checking
   * the raw bytes is the only way to tell whether Excel will read Bangla
   * product names correctly.
   */
  firstBytes: number[];
};

async function download(page: import("@playwright/test").Page, url: string): Promise<Fetched> {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { credentials: "same-origin" });
    const buffer = await response.arrayBuffer();
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body: new TextDecoder("utf-8").decode(buffer),
      firstBytes: [...new Uint8Array(buffer.slice(0, 3))],
    };
  }, url);
}

const INVENTORY = "/api/dashboard/inventory/export?scope=products";
const MOVEMENTS = "/api/dashboard/inventory/export?scope=movements";
const FINANCE = "/api/dashboard/finance/export?scope=transactions";
const PROFIT_LOSS = "/api/dashboard/finance/export?scope=profit-loss";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("every export refuses an anonymous request", async ({ page }) => {
    await page.goto("/");
    for (const url of [INVENTORY, MOVEMENTS, FINANCE, PROFIT_LOSS]) {
      const response = await download(page, url);
      expect(response.status, `${url} should not be readable signed out`).toBe(401);
    }
  });
});

test.describe("as a customer", () => {
  test.use({ storageState: storageStateFor("customer") });

  test("a customer cannot download staff data", async ({ page }) => {
    await page.goto("/account");
    for (const url of [INVENTORY, MOVEMENTS, FINANCE, PROFIT_LOSS]) {
      const response = await download(page, url);
      expect(response.status, `${url} should be forbidden to a customer`).toBe(403);
    }
  });
});

test.describe("as a moderator", () => {
  test.use({ storageState: storageStateFor("moderator") });

  test("a moderator cannot download the books", async ({ page }) => {
    await page.goto("/dashboard");
    for (const url of [FINANCE, PROFIT_LOSS]) {
      const response = await download(page, url);
      expect(response.status, `${url} should be forbidden to a moderator`).toBe(403);
    }
  });

  /**
   * The bug this pins: a moderator holds `inventory.view` so they can answer
   * "do you have this in stock?", but never what anything cost us. The stock
   * page hid the cost columns while the CSV still carried them — a hidden
   * column is not a permission.
   */
  test("a moderator's stock export carries no cost prices", async ({ page }) => {
    await page.goto("/dashboard");
    for (const url of [INVENTORY, MOVEMENTS]) {
      const response = await download(page, url);
      expect(response.status, `${url} should be readable by a moderator`).toBe(200);

      const header = response.body.split("\r\n")[0] ?? "";
      expect(header, `${url} leaked a cost column to a moderator`).not.toMatch(/cost/i);
      // Still a useful export — it just stops at what they may see.
      expect(header).toMatch(/Product|Date/);
    }
  });
});

test.describe("as the owner", () => {
  test.use({ storageState: storageStateFor("superAdmin") });

  test("the owner gets the full export, cost columns included", async ({ page }) => {
    await page.goto("/dashboard");
    const response = await download(page, INVENTORY);
    expect(response.status).toBe(200);
    expect(response.contentType).toContain("text/csv");

    const header = response.body.split("\r\n")[0] ?? "";
    expect(header).toMatch(/Cost price/);
    expect(header).toMatch(/Stock value at cost/);

    // A UTF-8 byte-order mark, so Excel on Windows reads Bangla product names
    // rather than mojibake.
    expect(response.firstBytes).toEqual([0xef, 0xbb, 0xbf]);
  });

  test("the books are downloadable by the owner", async ({ page }) => {
    await page.goto("/dashboard");
    for (const url of [FINANCE, PROFIT_LOSS]) {
      const response = await download(page, url);
      expect(response.status, url).toBe(200);
      expect(response.contentType).toContain("text/csv");
    }
  });
});
