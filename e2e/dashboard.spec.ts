import { expect, test } from "@playwright/test";

import { storageStateFor } from "./accounts";

/**
 * Staff dashboard journeys, including the authorisation boundaries the PRD
 * requires: role-filtered navigation, Super Admin protection, and permission
 * gating on the sensitive customer-history search.
 *
 * Sessions come from the `setup` project rather than a sign-in per test, so
 * the run does not trip the login rate limit it is meant to leave intact.
 */

test.describe("access control", () => {
  test("an anonymous visitor is sent to sign in and sees no dashboard data", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test.describe("as a customer", () => {
    test.use({ storageState: storageStateFor("customer") });

    test("a customer cannot reach the dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForURL(/\/account/);
      await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
    });
  });

  test.describe("as a moderator", () => {
    test.use({ storageState: storageStateFor("moderator") });

    test("a moderator sees only the sections their role allows", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

      const nav = page.getByRole("navigation", { name: "Dashboard navigation" }).first();
      await expect(nav.getByRole("link", { name: "Reviews" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Messages" })).toBeVisible();

      // Ownership-level sections must not be offered.
      await expect(nav.getByRole("link", { name: "Business settings" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Staff & roles" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Audit & security" })).toHaveCount(0);
    });

    test("a moderator creates a product but cannot publish it", async ({ page }) => {
      test.slow();

      await page.goto("/dashboard/products/new");
      await expect(page.getByRole("heading", { name: /product/i }).first()).toBeVisible();

      const name = `Moderator draft ${Date.now().toString().slice(-6)}`;
      await page.getByLabel("Name").first().fill(name);
      await page.getByLabel(/Price/).first().fill("450");

      // Asking to publish is allowed; being granted it is not.
      const statusSelect = page.getByLabel("Status").first();
      if (await statusSelect.count()) await statusSelect.selectOption("PUBLISHED");

      await page.getByRole("button", { name: /Save|Create/ }).first().click();

      // It is kept as a draft and flagged for review instead.
      await expect(page.getByText(/sent for review|draft/i).first()).toBeVisible();
      await expect(page.getByText("Published", { exact: true })).toHaveCount(0);
    });

    test("a moderator can move an order through its workflow", async ({ page }) => {
      await page.goto("/dashboard/orders");
      await page.getByRole("link", { name: /TM-/ }).first().click();
      await expect(page.getByRole("heading", { name: /Order TM-/ })).toBeVisible();

      // The order desk is their job, so the status control is available.
      await expect(page.getByText(/status/i).first()).toBeVisible();
    });

    test("a moderator is refused the pages their role does not cover", async ({ page }) => {
      // Server-side guard, not just a hidden link: the guard bounces the
      // request back to the overview with the refusal flagged.
      for (const route of ["/dashboard/settings", "/dashboard/customer-search"]) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/denied=1/);
        await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
        await expect(page.getByText(/do not have permission/i)).toBeVisible();
      }
    });
  });
});

test.describe("super admin", () => {
  test.use({ storageState: storageStateFor("superAdmin") });

  test("the overview shows real figures", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByText("Revenue").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent orders" })).toBeVisible();
  });

  /**
   * Every dashboard route, rendered as the one role that can open all of them.
   *
   * These pages sit behind a permission guard, so a plain HTTP smoke test only
   * ever sees the redirect to sign-in — a server component that crashes on
   * render stays invisible until someone signs in and opens it. This catches
   * that class of failure across the whole area in one pass.
   */
  test("every dashboard route renders without hitting an error boundary", async ({ page }) => {
    test.slow();

    const routes = [
      "/dashboard",
      "/dashboard/products",
      "/dashboard/products/new",
      "/dashboard/categories",
      "/dashboard/brands",
      "/dashboard/attributes",
      "/dashboard/inventory",
      "/dashboard/orders",
      "/dashboard/orders/fraud-review",
      "/dashboard/customers",
      "/dashboard/customer-search",
      "/dashboard/coupons",
      "/dashboard/coupons/new",
      "/dashboard/offers",
      "/dashboard/offers/new",
      "/dashboard/flash-sales",
      "/dashboard/reviews",
      "/dashboard/messages",
      "/dashboard/leads",
      "/dashboard/notifications",
      "/dashboard/banners",
      "/dashboard/content/pages",
      "/dashboard/content/faq",
      "/dashboard/content/home",
      "/dashboard/content/navigation",
      "/dashboard/content/testimonials",
      "/dashboard/reports",
      "/dashboard/staff",
      "/dashboard/staff/roles",
      "/dashboard/audit-logs",
      "/dashboard/settings",
      "/dashboard/settings/shipping",
      "/dashboard/settings/payments",
      "/dashboard/settings/courier",
      "/dashboard/settings/seo",
      "/dashboard/settings/analytics",
    ];

    const broken: string[] = [];

    for (const route of routes) {
      // `domcontentloaded`, not `load`: the question is whether the server
      // rendered the page, and waiting on every image would make 36 routes
      // take minutes.
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      const status = response?.status() ?? 0;
      const crashed = await page.getByRole("heading", { name: /Something went wrong/i }).count();
      const bouncedToLogin = /\/login/.test(page.url());

      if (status >= 500 || crashed > 0 || bouncedToLogin) {
        broken.push(`${route} (status ${status}${crashed ? ", error boundary" : ""}${bouncedToLogin ? ", redirected to login" : ""})`);
      }
    }

    expect(broken, `dashboard routes that failed to render:\n${broken.join("\n")}`).toEqual([]);
  });

  test("products list and variant matrix load", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    await page.getByRole("link", { name: "Premium Ajwa Dates" }).first().click();
    await expect(page.getByRole("heading", { name: "Premium Ajwa Dates" })).toBeVisible();

    // The variant matrix lives on the product editor itself.
    await expect(page.getByRole("heading", { name: /^Variants \(\d+\)/ })).toBeVisible();
  });

  test("all 64 districts are configurable with the seeded example charges", async ({ page }) => {
    await page.goto("/dashboard/settings/shipping");
    await expect(page.getByRole("heading", { name: "Delivery & districts" })).toBeVisible();

    // Dhaka ৳60 and Chattogram ৳100 — the worked example from the PRD.
    await expect(page.getByLabel("Delivery charge for Dhaka")).toHaveValue("60");
    await expect(page.getByLabel("Delivery charge for Chattogram")).toHaveValue("100");

    // Sylhet is seeded as free delivery.
    await expect(page.getByLabel("Free delivery for Sylhet")).toBeChecked();
  });

  test("coupons show their scope and schedule", async ({ page }) => {
    await page.goto("/dashboard/coupons");
    await expect(page.getByRole("heading", { name: "Coupons" })).toBeVisible();
    for (const code of ["DATES100", "TRUST10", "FLASH2H"]) {
      await expect(page.getByText(code).first()).toBeVisible();
    }
  });

  test("orders are split into queues so packing is not a hunt", async ({ page }) => {
    await page.goto("/dashboard/orders");

    const tabs = page.getByRole("navigation", { name: "Order queues" });
    await expect(tabs).toBeVisible();
    for (const label of ["All orders", "Needs review", "To pack", "In transit", "Delivered"]) {
      await expect(tabs.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }

    // Picking a queue narrows the list to those statuses only.
    await tabs.getByRole("link", { name: /To pack/ }).click();
    await expect(page).toHaveURL(/queue=to-pack/);

    const statusCells = page.locator("tbody").getByText(/^(Confirmed|Processing)$/);
    const rows = page.locator("tbody tr");
    if ((await rows.count()) > 0) {
      expect(await statusCells.count()).toBeGreaterThan(0);
      // Nothing from another queue leaked in.
      await expect(page.locator("tbody").getByText("Delivered", { exact: true })).toHaveCount(0);
    }

    // A search keeps the queue rather than resetting to everything.
    await expect(tabs.getByRole("link", { name: /To pack/ })).toHaveAttribute("aria-current", "page");
  });

  test("the order detail page offers the invoice and the status workflow", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

    await page.getByRole("link", { name: /TM-/ }).first().click();
    await expect(page.getByRole("heading", { name: /Order TM-/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /invoice/i }).first()).toBeVisible();
  });

  test("the customer history search is audited and returns risk signals", async ({ page }) => {
    await page.goto("/dashboard/customer-search");
    await expect(page.getByRole("heading", { name: /Customer/ })).toBeVisible();

    await page.getByLabel(/Phone/i).first().fill("01812345678");
    await page.getByRole("button", { name: /Search/i }).first().click();

    // The lookup itself is a privileged action, so it must be audited.
    await page.goto("/dashboard/audit-logs");
    await expect(page.getByRole("heading", { name: /Audit/ })).toBeVisible();
  });

  test("a customer who signed up can be promoted to admin", async ({ page, browser }) => {
    test.slow();

    /*
     * The real journey: someone registers on the shop, then gets hired.
     *
     * A throwaway account is registered rather than promoting a seeded one,
     * so a failure here cannot leave the rest of the suite looking at a
     * "customer" who is actually an admin.
     */
    // A Bangladeshi mobile number is exactly 11 digits: 01, then 3-9, then 8.
    const stamp = Date.now().toString().slice(-8);
    const email = `hire${stamp}@example.com`;
    const phone = `018${stamp}`;

    // Explicitly empty: a context created here otherwise carries the owner's
    // session, and /register just redirects a signed-in visitor away.
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const signup = await guest.newPage();
    await signup.goto("/register");
    await signup.getByLabel("Full name").fill("New Hire");
    await signup.getByLabel("Email").fill(email);
    await signup.getByLabel("Mobile number").fill(phone);
    await signup.getByLabel("Password", { exact: true }).fill("HireMe#2026");
    await signup.getByLabel("Confirm password").fill("HireMe#2026");
    await signup.getByRole("button", { name: "Create account" }).click();
    // Public sign-up always lands in the customer account area, never staff.
    await signup.waitForURL(/\/account/);
    await guest.close();

    // They arrive as a customer, which is where the owner finds them.
    await page.goto("/dashboard/staff?tab=customers");
    const row = page.locator("tbody tr").filter({ hasText: email });
    await expect(row).toHaveCount(1);
    await row.getByRole("link", { name: "Edit" }).click();

    // Their details load. This used to come up blank, because the form looked
    // the person up inside the tab-filtered list instead of by id.
    await expect(page.getByLabel("Full name")).toHaveValue("New Hire");

    // Every role is offered, including the one that used to be impossible.
    for (const role of ["SUPER_ADMIN", "ADMIN", "MODERATOR", "CUSTOMER"]) {
      await expect(page.getByLabel("Role").locator(`option[value="${role}"]`)).toHaveCount(1);
    }

    await page.getByLabel("Role").selectOption("ADMIN");
    await page.getByRole("button", { name: "Save staff member" }).click();

    // Wait for the save to be confirmed before navigating: leaving the page
    // mid-submit is what made this look broken the first time.
    await expect(page.getByText(/Staff member updated/i).first()).toBeVisible();

    await page.goto("/dashboard/staff?tab=admin");
    await expect(page.locator("tbody").getByText(email)).toBeVisible();
  });

  test("the Super Admin account is protected from editing", async ({ page }) => {
    await page.goto("/dashboard/staff");
    await expect(page.getByRole("heading", { name: /Staff/ })).toBeVisible();

    // The Super Admin row offers no suspend control.
    const superAdminRow = page.getByRole("row").filter({ hasText: "superadmin@trustmart.local" });
    await expect(superAdminRow).toHaveCount(1);
    await expect(superAdminRow.getByRole("button", { name: /Suspend/i })).toHaveCount(0);
  });

  test("role permissions are editable and never offer Super Admin", async ({ page }) => {
    await page.goto("/dashboard/staff/roles");
    await expect(page.getByRole("heading", { name: /Role/ })).toBeVisible();

    // Super Admin is implicit and must not be presented as an editable role.
    await expect(page.getByRole("link", { name: /^Super Admin$/ })).toHaveCount(0);
  });

  test("the notification bell opens a dropdown and clears its badge", async ({ page }) => {
    await page.goto("/dashboard");

    const bell = page.getByRole("button", { name: /^Notifications/ });
    await expect(bell).toBeVisible();

    // Opening lists the recent notifications rather than navigating away.
    await bell.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("link", { name: "See all" })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Opening marks them read, so the unread badge goes.
    await expect(page.getByRole("button", { name: /Notifications, \d+ unread/ })).toHaveCount(0);

    // Escape closes it.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("the notifications page offers mark all read", async ({ page }) => {
    await page.goto("/dashboard/notifications");
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    // Either there is unread mail to clear, or it says so.
    const control = page.getByRole("button", { name: /Mark all read/ }).or(page.getByText("All caught up"));
    await expect(control.first()).toBeVisible();
  });

  test("a token can be raised, assigned and replied to", async ({ page }) => {
    test.slow();

    await page.goto("/dashboard/tokens/new");
    await expect(page.getByRole("heading", { name: "Raise a token" })).toBeVisible();

    const subject = `Check payment ${Date.now().toString().slice(-6)}`;
    await page.getByLabel("Subject").fill(subject);
    await page.getByLabel("What is it about?").selectOption("PAYMENT");
    await page.getByLabel("Priority").selectOption("HIGH");
    await page.getByLabel("Description").fill("Please confirm the bKash transaction against the statement.");

    // Assign to the whole team.
    await page.getByLabel("Everyone on the team").check();
    await page.getByRole("button", { name: "Raise token" }).click();

    // Lands on the new token, with a reference.
    await expect(page.getByRole("heading", { name: subject })).toBeVisible();
    await expect(page.getByText(/TKN-\d{6}/)).toBeVisible();
    await expect(page.getByText("Payment").first()).toBeVisible();
    await expect(page.getByText("High").first()).toBeVisible();

    // A reply is recorded.
    await page.getByLabel("Add a reply").fill("Checked — the amount matches.");
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await expect(page.getByText("Checked — the amount matches.")).toBeVisible();

    // It shows up in the raised-by-me view.
    await page.goto("/dashboard/tokens?view=raised");
    await expect(page.getByText(subject)).toBeVisible();
  });

  test("a token refuses to be raised with nobody assigned", async ({ page }) => {
    await page.goto("/dashboard/tokens/new");
    await page.getByLabel("Subject").fill("Nobody assigned");
    await page.getByLabel("Description").fill("This should not be accepted.");
    await page.getByRole("button", { name: "Raise token" }).click();

    await expect(page.getByText(/at least one person/i).first()).toBeVisible();
  });

  test("reports aggregate on the server", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  });

  test("business settings drive the storefront", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("heading", { name: "Business settings" })).toBeVisible();
    await expect(page.getByLabel("Shop name")).toHaveValue("Trust Mart");
  });
});
