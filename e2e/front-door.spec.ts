import { expect, test } from "@playwright/test";
import { PROD_SAFE } from "./testUser";

// The public front door, as someone who isn't signed in sees it. Read-only, so it runs against
// production after every deploy too.
test.use({ storageState: { cookies: [], origins: [] } });

const PAGES: [string, RegExp][] = [
  ["/", /Plan your week/],
  ["/trainers", /not in WhatsApp/],
  ["/gyms", /Members, trainers and fees/],
  ["/demo", /Asha.s week/],
];

for (const [path, heading] of PAGES) {
  test(`${path} is open to signed-out visitors`, { tag: PROD_SAFE }, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() >= 500) failures.push(`HTTP ${response.status()} ${response.url()}`);
    });

    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    expect(failures).toEqual([]);
  });
}

test("Start free opens the sign-up form", { tag: PROD_SAFE }, async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start free" }).first().click();
  await expect(page).toHaveURL(/\/login\?signup=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your account");
});

test("link previews have a GymJourno image", { tag: PROD_SAFE }, async ({ page, request }) => {
  await page.goto("/trainers");
  const image = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(image).toBeTruthy();
  const response = await request.get(new URL(image!).pathname + new URL(image!).search);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("the app's own pages still need an account", { tag: PROD_SAFE }, async ({ page }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login/);
});
