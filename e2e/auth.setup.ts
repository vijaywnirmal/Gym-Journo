import { expect, test as setup } from "@playwright/test";
import { recreateTestUser, TEST_USER } from "./testUser";

// Runs before the specs: a fresh test user, signed in through the real login form, with the
// session saved for every spec to reuse.
setup("sign in as a fresh test user", async ({ page }) => {
  await recreateTestUser();

  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(TEST_USER.email);
  await page.getByPlaceholder("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: new RegExp(TEST_USER.firstName) })).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
