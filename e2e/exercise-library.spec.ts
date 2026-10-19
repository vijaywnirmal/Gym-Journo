import { expect, test } from "@playwright/test";

test("a muscle group lists ten exercises at a time, and a name opens its tutorial", async ({ page }) => {
  await page.goto("/exercises");

  await page.getByRole("button", { name: /Chest/ }).click();
  const chest = page.locator("[aria-busy] > ul > li"); // rows of the open group's paged list
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
  await page.getByRole("button", { name: "New custom exercise" }).click();
  await page.getByLabel("Name", { exact: true }).fill("E2E Cable Curl");
  await page.getByRole("button", { name: "Biceps", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();

  await page.getByLabel("Search exercises").fill("e2e cable curl");
  const row = page.getByRole("button", { name: /^E2E Cable Curl/ });
  await expect(row).toBeVisible();

  // Deleting takes two taps: open the row, ask to delete, then confirm.
  await row.click();
  await page.getByRole("button", { name: "Delete exercise" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("No exercises match.")).toBeVisible();
});
