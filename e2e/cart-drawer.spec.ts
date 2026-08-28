import { expect, test } from "@playwright/test";

/**
 * The mini cart.
 *
 * Two things must hold on every screen: it opens without the page scrolling
 * sideways, and it closes by the routes people actually reach for — Escape and
 * a tap outside. A drawer that traps someone on a phone is worse than no
 * drawer.
 */

/**
 * Waits for the slide-in to finish before anything measures the panel.
 *
 * `toBeVisible` resolves as soon as the element is painted, which is partway
 * through `tm-slide-in-right` — the panel is still translated off the right
 * edge, so its bounding box reads as far wider than the viewport and an
 * overflow assertion fails on a drawer that is perfectly fine once settled.
 */
async function settled(page: import("@playwright/test").Page): Promise<void> {
  await page
    .locator(".drawer-panel")
    .evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
}

test.describe("cart drawer", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("opens after adding to the cart and shows what went in", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Add to cart" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Your cart" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Checkout" })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "View cart" })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Continue shopping" })).toBeVisible();

    // The badge on the trigger reflects what the drawer is showing.
    await expect(page.getByRole("button", { name: /^Cart, 1 item$/ })).toBeVisible();
  });

  test("closes on Escape", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Your cart" });
    await expect(drawer).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("closes when the page behind it is tapped", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Your cart" });
    await expect(drawer).toBeVisible();

    await page.getByRole("button", { name: "Close cart" }).first().click();
    await expect(drawer).toBeHidden();
  });

  test("quantity can be changed from inside the drawer", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Your cart" });
    await expect(drawer).toBeVisible();
    await settled(page);

    await drawer.getByRole("button", { name: /^Increase / }).first().click();
    await expect(page.getByRole("button", { name: /^Cart, 2 items$/ })).toBeVisible();
  });

  test("fits a 320px screen and does not widen the page", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Your cart" });
    await expect(drawer).toBeVisible();
    await settled(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the open drawer widens the page").toBeLessThanOrEqual(2);

    // And it is fully on screen, not half past the right edge.
    const box = await page.locator(".drawer-panel").boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.x)).toBeGreaterThanOrEqual(0);
    expect(Math.round(box!.x + box!.width)).toBeLessThanOrEqual(321);
  });
});
