import { expect, test } from "@playwright/test";

/**
 * Critical customer journey: browse → variant → cart → coupon → checkout →
 * confirmation → invoice PDF → order tracking.
 */

const CUSTOMER = { email: "customer@trustmart.local", password: "Customer#2026" };

test.describe("storefront", () => {
  test("home page renders shop chrome and products", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Trust Mart/i }).first()).toBeVisible();
    await expect(page.locator("article.product-card").first()).toBeVisible();
  });

  test("shop page filters and paginates", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "All products" })).toBeVisible();
    await expect(page.locator("article.product-card").first()).toBeVisible();

    // The filters are URL-driven, so the checkbox reflects the URL after navigation.
    await page.getByLabel("In stock only").click();
    await expect(page).toHaveURL(/stock=1/);
    await expect(page.getByLabel("In stock only")).toBeChecked();
  });

  test("search finds a seeded product", async ({ page }) => {
    await page.goto("/search?q=honey");
    await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sundarban Raw Honey/i }).first()).toBeVisible();
  });

  test("product page shows variant pricing and updates on selection", async ({ page }) => {
    await page.goto("/product/premium-ajwa-dates");
    await expect(page.getByRole("heading", { name: "Premium Ajwa Dates" })).toBeVisible();

    // 500g is ৳500 and 1kg is ৳900 — the price must follow the selection.
    await page.getByRole("button", { name: "500g", exact: true }).click();
    await expect(page.locator(".price-lg")).toHaveText("৳500");

    await page.getByRole("button", { name: "1kg", exact: true }).click();
    await expect(page.locator(".price-lg")).toHaveText("৳900");

    await page.getByRole("button", { name: "2kg", exact: true }).click();
    await expect(page.locator(".price-lg")).toHaveText("৳1,700");
  });

  test("policy pages are published from the CMS", async ({ page }) => {
    for (const [path, heading] of [
      ["/terms", "Terms & Conditions"],
      ["/privacy", "Privacy Policy"],
      ["/refund-policy", "Refund Policy"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("faq page renders questions", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByText("Do I need an account to place an order?")).toBeVisible();
  });
});

test.describe("guest checkout", () => {
  test("add to cart, apply a coupon, and place a cash-on-delivery order", async ({ page }) => {
    // The full purchase path plus the post-order checks is a lot of navigation.
    test.slow();

    // 1. Choose a variant and add it to the cart.
    await page.goto("/product/premium-ajwa-dates");
    await page.getByRole("button", { name: "1kg", exact: true }).click();
    // Exact: the related-products grid below carries its own add buttons, and
    // those name the product they add ("Add to cart — …").
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();

    // 2. The cart shows the variant and its price.
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
    await expect(page.getByText("1kg", { exact: true })).toBeVisible();

    // 3. A product-specific coupon applies. The confirmation appears both in
    //    the cart panel and as a toast, so scope the assertions to the page.
    const main = page.locator("#main-content");
    await page.getByLabel("Have a coupon?").fill("DATES100");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(main.getByText(/Coupon DATES100 applied/i)).toBeVisible();
    await expect(main.getByText("You saved ৳100.")).toBeVisible();

    // A code that matches nothing must be refused, not echoed back as applied.
    await page.goto("/cart?coupon=NOTAREALCODE");
    await expect(main.getByText(/not valid/i)).toBeVisible();
    await expect(main.getByText(/NOTAREALCODE applied/i)).toHaveCount(0);
    await page.goto("/cart?coupon=DATES100");

    // 4. Checkout: choosing a district recalculates delivery on the server.
    await page.getByRole("link", { name: /Proceed to checkout/i }).click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    await page.getByLabel("Full name").fill("Playwright Tester");
    await page.getByLabel("Mobile number").fill("01711111111");
    await page.getByLabel("District").selectOption({ label: "Dhaka — ৳60" });
    await page.getByLabel("Full address").fill("House 1, Road 1, Test Area");

    await expect(page.getByText("Delivery — Dhaka")).toBeVisible();

    // 5. Place the order.
    await page.getByRole("button", { name: /Place order/i }).click();

    // 6. Confirmation carries an order number and an invoice link.
    await expect(page.getByRole("heading", { name: /Thank you/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Order TM-/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Download invoice/i })).toBeVisible();

    // 7. The cart is genuinely gone afterwards. Going back to checkout used to
    //    re-show the items that had just been bought, because the cart pages
    //    were served from cache even though the cart itself had been emptied.
    await page.goto("/cart");
    await expect(page.getByText(/cart is empty/i)).toBeVisible();

    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: /Place order/i })).toHaveCount(0);

    // The header badge must have cleared with it. The trigger is a button now
    // — it opens the drawer rather than navigating — and an empty cart drops
    // the count from its label entirely rather than saying "0 items".
    await expect(page.getByRole("button", { name: /^Cart$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Cart, / })).toHaveCount(0);
  });

  test("the invoice endpoint returns a real PDF", async ({ page, request }) => {
    await page.goto("/product/aromatic-kalijira-rice-5kg");
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();

    await page.goto("/checkout");
    await page.getByLabel("Full name").fill("Invoice Tester");
    await page.getByLabel("Mobile number").fill("01722222222");
    await page.getByLabel("District").selectOption({ label: "Sylhet — free delivery" });
    await page.getByLabel("Full address").fill("Zindabazar, Sylhet");
    await page.getByRole("button", { name: /Place order/i }).click();
    await expect(page.getByRole("heading", { name: /Thank you/i })).toBeVisible({ timeout: 30_000 });

    // Free-delivery district — the order must show no delivery charge.
    await expect(page.getByText("Delivery — Sylhet")).toBeVisible();

    const invoiceHref = await page.getByRole("link", { name: /Download invoice/i }).getAttribute("href");
    expect(invoiceHref).toBeTruthy();

    const response = await request.get(invoiceHref!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");

    const body = await response.body();
    // A PDF always starts with %PDF-
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.byteLength).toBeGreaterThan(1000);
  });
});

test.describe("customer account", () => {
  test("sign in, view orders, and reach the invoice", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CUSTOMER.email);
    await page.getByLabel("Password", { exact: true }).fill(CUSTOMER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();

    await page.goto("/account/orders");
    await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
    await page.getByRole("link", { name: "View details" }).first().click();

    await expect(page.getByRole("heading", { name: /Order TM-/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Download invoice/i })).toBeVisible();
  });

  test("a customer cannot open another customer's order", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CUSTOMER.email);
    await page.getByLabel("Password", { exact: true }).fill(CUSTOMER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/);

    // A well-formed id that belongs to nobody must show "not found", never another
    // customer's order.
    await page.goto("/account/orders/clzzzzzzzzzzzzzzzzzzzzzzz");
    await expect(page.getByText(/couldn.t find that page/i)).toBeVisible();
  });
});

test.describe("sign-in form", () => {
  test("the password can be revealed and hidden again", async ({ page }) => {
    await page.goto("/login");

    const password = page.getByLabel("Password", { exact: true });
    await password.fill("something-secret");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });
});

test.describe("order tracking", () => {
  test("requires both the order number and the phone number", async ({ page }) => {
    await page.goto("/track-order");

    // Right order number, wrong phone → generic failure, no data leaked.
    await page.getByLabel("Order number").fill("TM-260101-1001");
    await page.getByLabel("Mobile number on the order").fill("01999999999");
    await page.getByRole("button", { name: "Track order" }).click();
    await expect(page.getByText(/could not find an order/i)).toBeVisible();

    // Correct pair → the timeline appears.
    await page.getByLabel("Mobile number on the order").fill("01812345678");
    await page.getByRole("button", { name: "Track order" }).click();
    await expect(page.getByRole("heading", { name: "Order TM-260101-1001" })).toBeVisible();
    await expect(page.getByText("Delivery timeline")).toBeVisible();
  });
});
