import { expect, test } from "@playwright/test";
import { PROD_SAFE, TEST_USER } from "./testUser";

test("Today greets the signed-in person", { tag: PROD_SAFE }, async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: new RegExp(`, ${TEST_USER.firstName}$`) })).toBeVisible();
});

// Local only: it checks the fresh user's goal and empty day, which a long-lived account won't have.
test("Today shows a fresh user's goal and an empty day", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Build muscle · 3 training days/week")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing planned for today" })).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pages redirect to login and the API answers 401", { tag: PROD_SAFE }, async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login$/);

    const response = await page.request.get("/api/exercises");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Not signed in" });
  });

  test("the privacy page opens without signing in, linked from the login page", { tag: PROD_SAFE }, async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "privacy@gymjourno.fit" }).first()).toBeVisible();
  });
});
