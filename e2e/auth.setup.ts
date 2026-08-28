import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";

import { ACCOUNTS, STORAGE_DIR, storageStateFor, type AccountName } from "./accounts";

/**
 * Sign each seeded role in once and save its cookies, so the suites can reuse
 * the session instead of re-authenticating in every test. Besides being
 * faster, this keeps the run under the login rate limit the PRD asks for —
 * hammering the sign-in form is exactly what that limit is there to stop.
 */
for (const [name, account] of Object.entries(ACCOUNTS) as [AccountName, (typeof ACCOUNTS)[AccountName]][]) {
  setup(`authenticate as ${name}`, async ({ page }) => {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });

    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Staff land on the dashboard, customers on their account area.
    await page.waitForURL(/\/(dashboard|account)/);
    await expect(page).not.toHaveURL(/\/login/);

    await page.context().storageState({ path: storageStateFor(name) });
  });
}
