import { expect, test as setup } from "@playwright/test";
import { isRemote, recreateTestUser, TEST_USER } from "./testUser";

// Runs before the specs: the test user signed in through the real login form, with the session saved
// for every spec to reuse. Locally it is a fresh user; on a deployed site it is an existing account.
// The specs never sign out: that would end every session of the account.
setup("sign in as the test user", async ({ page }) => {
  if (!isRemote) await recreateTestUser();

  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(TEST_USER.email);
  await page.getByPlaceholder("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: new RegExp(TEST_USER.firstName) })).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
