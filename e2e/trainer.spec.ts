import { expect, test } from "@playwright/test";
import { adminClient, isRemote, TEST_USER } from "./testUser";

// Local only: it creates a trainer account and links the test user to it as their client.
// The trainer is removed at the end; the plan it made goes with the client's day.
const TRAINER = { email: "e2e-trainer@example.test", password: "e2e-trainer-123", name: "Ravi" };
// A day far from the ones the other specs use.
const DATE = "2030-01-08";

test.skip(isRemote, "creates a trainer account");

test("a trainer plans a client's day, the client sees who planned it, and the trainer sees their edit", async ({
  page,
  browser,
}) => {
  const admin = adminClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const previous = list.users.find((user) => user.email === TRAINER.email);
  if (previous) await admin.auth.admin.deleteUser(previous.id);
  const clientId = list.users.find((user) => user.email === TEST_USER.email)?.id;
  if (!clientId) throw new Error("The test user should exist (auth.setup.ts)");

  const { data: created, error } = await admin.auth.admin.createUser({
    email: TRAINER.email,
    password: TRAINER.password,
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error("createUser returned no user");
  const trainerId = created.user.id;
  for (const [table, row] of [
    ["profiles", { id: trainerId, first_name: TRAINER.name, full_name: TRAINER.name, onboarded: true, timezone: "UTC" }],
    ["trainer_profiles", { user_id: trainerId, display_name: TRAINER.name, gym_name: "Iron Gym" }],
    ["trainer_clients", { trainer_id: trainerId, client_id: clientId }],
  ] as const) {
    const { error: insertError } = await admin.from(table).insert(row);
    if (insertError) throw insertError;
  }

  try {
    // The trainer, in a browser of their own.
    const trainerContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const trainerPage = await trainerContext.newPage();
    await trainerPage.goto("/login");
    await trainerPage.getByPlaceholder("you@example.com").fill(TRAINER.email);
    await trainerPage.getByPlaceholder("Password").fill(TRAINER.password);
    await trainerPage.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(trainerPage.getByRole("heading", { name: new RegExp(TRAINER.name) })).toBeVisible();

    await trainerPage.goto("/trainer");
    await expect(trainerPage.getByRole("link", { name: new RegExp(TEST_USER.firstName) })).toBeVisible();

    await trainerPage.goto(`/trainer/clients/${clientId}/plan/${DATE}`);
    await trainerPage.getByLabel("Name").fill("Legs from Ravi");
    await trainerPage.getByRole("button", { name: "Save plan" }).click();
    await expect(trainerPage.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    // The client sees who planned it, and that changes are shown to the trainer.
    await page.goto(`/calendar?week=${DATE}`);
    await expect(page.getByRole("listitem").filter({ hasText: "Legs from Ravi" })).toContainText("Planned by Ravi");
    await page.goto(`/schedule/${DATE}`);
    await expect(page.getByText("Ravi planned this and can see your changes.")).toBeVisible();
    await page.getByLabel("Name").fill("Legs, lighter");
    await page.getByRole("button", { name: "Save plan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.goto(`/calendar?week=${DATE}`);
    await expect(page.getByRole("listitem").filter({ hasText: "Legs, lighter" })).toContainText(
      "Planned by Ravi · edited by you"
    );

    // The trainer sees the client changed it.
    await trainerPage.goto(`/trainer/clients/${clientId}?week=${DATE}`);
    await expect(trainerPage.getByRole("listitem").filter({ hasText: "Legs, lighter" })).toContainText(
      `Edited by ${TEST_USER.firstName}`
    );
    await trainerContext.close();
  } finally {
    await admin.auth.admin.deleteUser(trainerId);
    await admin.from("workout_plans").delete().eq("user_id", clientId).eq("date", DATE);
  }
});
