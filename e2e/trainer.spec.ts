import { expect, test } from "@playwright/test";
import { PROD_SAFE } from "./testUser";

// The trainer screens, signed out and as the test user (who isn't a trainer). Read-only: nothing
// here submits trainer setup, accepts an invite or makes a link, so it runs against production too.

// Well-formed, but no invite has it.
const UNKNOWN_CODE = "zzzzzzzzzz";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the login page's \"I'm a trainer\" link opens trainer sign-up", { tag: PROD_SAFE }, async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "I'm a trainer" }).click();
    await expect(page).toHaveURL(/\/login\?role=trainer$/);
    await expect(page.getByRole("heading", { name: "Create your trainer account" })).toBeVisible();
  });

  test("an invite link asks for an account first", { tag: PROD_SAFE }, async ({ page }) => {
    await page.goto(`/join/${UNKNOWN_CODE}`);
    await expect(page).toHaveURL(/\/login\?invite=1$/);
    await expect(page.getByText("Create an account to join your trainer.")).toBeVisible();
  });
});

test("Clients sends someone who isn't a trainer to trainer setup", { tag: PROD_SAFE }, async ({ page }) => {
  await page.goto("/trainer");
  await expect(page).toHaveURL(/\/trainer\/setup$/);
  await expect(page.getByRole("heading", { name: "Set up your trainer account" })).toBeVisible();
});

test("an unknown invite code says the link doesn't work", { tag: PROD_SAFE }, async ({ page }) => {
  await page.goto(`/join/${UNKNOWN_CODE}`);
  await expect(page.getByRole("heading", { name: "This invite link doesn't work" })).toBeVisible();
});

test("Profile offers to set up a trainer account", { tag: PROD_SAFE }, async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: /^Set up a trainer account/ })).toHaveAttribute("href", "/trainer/setup");
});
