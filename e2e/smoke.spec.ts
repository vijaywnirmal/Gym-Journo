import { expect, test } from "@playwright/test";
import { PROD_SAFE, testDate } from "./testUser";

// Every main page renders for a signed-in person: no server error, no uncaught page error, and its
// heading on screen. Read-only, so it runs against production after every deploy too.
const PAGES = [
  "/",
  "/calendar",
  `/schedule/${testDate(1)}`,
  `/log/${testDate()}`,
  "/history",
  "/progress",
  "/exercises",
  "/body",
  "/programs",
  "/suggestions",
  "/coach",
  "/ai-plan",
  "/profile",
];

for (const path of PAGES) {
  test(`${path} renders`, { tag: PROD_SAFE }, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() >= 500) failures.push(`HTTP ${response.status()} ${response.url()}`);
    });

    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(failures).toEqual([]);
  });
}
