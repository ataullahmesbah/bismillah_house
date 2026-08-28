import { expect, test } from "@playwright/test";

import { storageStateFor } from "./accounts";

/**
 * Responsive checks.
 *
 * The failure this catches is horizontal overflow: one wide table or an
 * unwrapped price row pushes the whole page sideways, and on a phone every
 * screen then scrolls left-to-right. It is easy to introduce and easy to miss
 * on a desktop browser.
 */

const VIEWPORTS = [
  { name: "small phone", width: 320, height: 640 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
];

const PUBLIC_PAGES = ["/", "/shop", "/product/premium-ajwa-dates", "/cart", "/login", "/register", "/faq"];

/**
 * The dashboard sections added since: inventory, courier and finance are all
 * table-heavy, which is exactly where sideways scroll comes from.
 */
const STAFF_PAGES = [
  "/dashboard",
  "/dashboard/orders",
  "/dashboard/inventory",
  "/dashboard/inventory/products",
  "/dashboard/inventory/adjustments",
  "/dashboard/inventory/warehouses",
  "/dashboard/inventory/reports",
  "/dashboard/courier",
  "/dashboard/courier/shipments",
  "/dashboard/courier/settlements",
  "/dashboard/finance",
  "/dashboard/finance/transactions",
  "/dashboard/finance/expenses",
  "/dashboard/finance/profit-loss",
  "/dashboard/finance/cash-flow",
  "/dashboard/settings",
  "/dashboard/settings/courier",
  "/dashboard/settings/operations",
];

/**
 * Reports the smallest element sticking past the viewport, ignoring anything
 * inside a scroll container.
 *
 * A table inside `.table-wrap` is *meant* to be wider than the screen — that is
 * what the container is for — so naming it sends the fix to the wrong place.
 * The smallest offender is the cause; its ancestors merely carry it.
 */
async function overflowCulprit(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    // A few pixels of slack absorbs sub-pixel rounding in the layout engine.
    if (doc.scrollWidth - doc.clientWidth <= 2) return null;

    function insideScroller(el: Element): boolean {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
      return false;
    }

    let culprit: { width: number; description: string } | null = null;
    for (const el of document.querySelectorAll("*")) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.right <= doc.clientWidth + 1) continue;
      if (insideScroller(el)) continue;
      if (!culprit || box.width < culprit.width) {
        culprit = {
          width: box.width,
          description:
            `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}"> ` +
            `+${Math.round(box.right - doc.clientWidth)}px — "${(el.textContent ?? "").trim().slice(0, 40)}"`,
        };
      }
    }
    return culprit?.description ?? null;
  });
}

for (const viewport of VIEWPORTS) {
  test(`storefront does not scroll sideways on a ${viewport.name}`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const overflowing: string[] = [];

    for (const path of PUBLIC_PAGES) {
      await page.goto(path, { waitUntil: "domcontentloaded" });

      const culprit = await overflowCulprit(page);
      if (culprit) overflowing.push(`${path} → ${culprit}`);
    }

    expect(overflowing, `pages wider than the viewport:\n${overflowing.join("\n")}`).toEqual([]);
  });
}

test.describe("dashboard on a phone", () => {
  test.use({ storageState: storageStateFor("superAdmin") });

  for (const viewport of VIEWPORTS) {
    test(`no dashboard section scrolls sideways on a ${viewport.name}`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const overflowing: string[] = [];

      for (const path of STAFF_PAGES) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const culprit = await overflowCulprit(page);
        if (culprit) overflowing.push(`${path} → ${culprit}`);
      }

      expect(overflowing, `dashboard pages wider than the viewport:\n${overflowing.join("\n")}`).toEqual([]);
    });
  }

  test("the menu opens from the header and the page does not overflow", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const measure = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // Closed first: the page itself must fit.
    expect(await measure(), "dashboard overflows before the drawer is opened").toBeLessThanOrEqual(2);

    // The trigger belongs in the header, not loose in the page.
    const trigger = page.getByRole("button", { name: "Open dashboard menu" });
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Dashboard navigation" }).getByRole("link", { name: "Orders" })).toBeVisible();

    // And opening the drawer must not widen it either.
    expect(await measure(), "the open drawer widens the page").toBeLessThanOrEqual(2);
  });
});
