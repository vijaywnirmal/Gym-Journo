import { expect, test } from "@playwright/test";
import { TEST_USER } from "./testUser";

test("Today greets the signed-in person and shows their goal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: new RegExp(`, ${TEST_USER.firstName}$`) })).toBeVisible();
  await expect(page.getByText("Build muscle · 3 training days/week")).toBeVisible();
  await expect(page.getByText("Nothing scheduled for today.")).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pages redirect to login and the API answers 401", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login$/);

    const response = await page.request.get("/api/exercises");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Not signed in" });
  });
});
