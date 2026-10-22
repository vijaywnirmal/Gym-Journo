import { expect, test } from "@playwright/test";
import { isRemote, PROD_SAFE, testDate } from "./testUser";

// Removes the plan it saves. On a deployed site it uses a day a year ahead, away from the days the
// account is used for.
test("a day scheduled as rest shows on the calendar without a Log button", { tag: PROD_SAFE }, async ({ page }) => {
  const date = testDate(isRemote ? 365 : 1);
  await page.goto(`/schedule/${date}`);
  await page.getByRole("radio", { name: "Rest" }).click();
  await page.getByPlaceholder(/optional/).fill("Deload");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  await page.goto(`/calendar?week=${date}`);
  const day = page.getByRole("listitem").filter({ hasText: "Rest day · Deload" });
  await expect(day).toBeVisible();
  await expect(day.getByRole("link", { name: "Log" })).toHaveCount(0);

  await page.goto(`/schedule/${date}`);
  await page.getByRole("button", { name: "Remove this day's plan" }).click();
  await page.getByRole("button", { name: "Remove plan" }).click();
  await page.goto(`/calendar?week=${date}`);
  await expect(page.getByRole("listitem").filter({ hasText: "Rest day · Deload" })).toHaveCount(0);
});

// Local only: a workout log can't be deleted, so on a deployed site it would pile up a log a day.
test("a logged set is saved and still there after a reload", async ({ page }) => {
  await page.goto(`/log/${testDate()}`);

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
    page.getByRole("listitem").filter({ hasText: "Barbell Bench Press" }).filter({ hasText: "60kg×5" }),
  ).toBeVisible();
});

// Local only, like the test above. The first save of a past day creates its log and re-renders the
// page; the logger must stay open (not turn into the day's summary) while sets are still being typed.
test("logging a past day keeps the logger open after the first save", async ({ page }) => {
  await page.goto(`/log/${testDate(-3)}`);
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByLabel("Search exercises").fill("barbell row");
  await page.getByRole("button", { name: /^Barbell Row/ }).first().click();

  await page.getByLabel("Set 1 weight").fill("50");
  await page.getByLabel("Set 1 reps").fill("8");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Typed after the first save, while the page re-renders with the newly created log.
  await page.getByRole("button", { name: "Add set" }).click();
  await page.getByLabel("Set 2 weight").fill("50");
  await page.getByLabel("Set 2 reps").fill("7");
  await page.waitForTimeout(5_000);
  await expect(page.getByLabel("Set 2 reps")).toHaveValue("7");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Coming back later, the logged day opens on its summary with both sets.
  await page.reload();
  await expect(page.getByText("50kg × 8")).toBeVisible();
  await expect(page.getByText("50kg × 7")).toBeVisible();
});
