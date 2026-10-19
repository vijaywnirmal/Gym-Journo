import { expect, test } from "@playwright/test";
import { todayUtc } from "./testUser";

test("a day scheduled as rest shows on the calendar without a Log button", async ({ page }) => {
  const date = todayUtc(1);
  await page.goto(`/schedule/${date}`);
  await page.getByRole("radio", { name: "Rest" }).click();
  await page.getByPlaceholder(/optional/).fill("Deload");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  await page.goto(`/calendar?week=${date}`);
  const day = page.getByRole("listitem").filter({ hasText: "Rest day · Deload" });
  await expect(day).toBeVisible();
  await expect(day.getByRole("link", { name: "Log" })).toHaveCount(0);
});

test("a logged set is saved and still there after a reload", async ({ page }) => {
  await page.goto(`/log/${todayUtc()}`);

  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByLabel("Search exercises").fill("barbell bench press");
  await page.getByRole("button", { name: /^Barbell Bench Press/ }).first().click();

  await page.getByLabel("Set 1 weight").fill("60");
  await page.getByLabel("Set 1 reps").fill("5");
  // The status must not claim "Saved" while the edit is still waiting to be sent.
  await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Set 1 weight")).toHaveValue("60");
  await expect(page.getByLabel("Set 1 reps")).toHaveValue("5");

  await page.goto("/history");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Barbell Bench Press" }).filter({ hasText: "5×60kg" }),
  ).toBeVisible();
});
