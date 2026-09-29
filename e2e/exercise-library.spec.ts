import { expect, test } from "@playwright/test";

test("a muscle group lists ten exercises at a time, and a name opens its tutorial", async ({ page }) => {
  await page.goto("/exercises");

  await page.getByRole("button", { name: /Chest/ }).click();
  const chest = page.locator('[id] > div > ul > li'); // rows inside the open group
  await expect(chest).toHaveCount(10);

  await page.getByRole("button", { name: "Load more" }).click();
  await expect(chest).toHaveCount(20);

  await page.getByRole("button", { name: /^Barbell Bench Press/ }).first().click();
  await expect(page.getByAltText("Barbell Bench Press: start position")).toBeVisible();
  await expect(page.getByText("Chest · Shoulders · Triceps")).toBeVisible();
});

test("search expands gym shorthand and pages through matches across groups", async ({ page }) => {
  await page.goto("/exercises");
  await page.getByLabel("Search exercises").fill("db press");

  await expect(page.getByRole("button", { name: /^Dumbbell Bench Press/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Barbell Bench Press/ })).toHaveCount(0);
});

test("a custom exercise can be created, found and deleted", async ({ page }) => {
  await page.goto("/exercises");
  await page.getByText("+ Add custom exercise").click();
  await page.getByPlaceholder("Exercise name").fill("E2E Cable Curl");
  await page.locator("label", { hasText: /^Biceps$/ }).click();
  await page.getByRole("button", { name: "Add exercise" }).click();

  await page.getByLabel("Search exercises").fill("e2e cable curl");
  const row = page.getByRole("button", { name: /^E2E Cable Curl/ });
  await expect(row).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("No exercises match.")).toBeVisible();
});
