import { expect, test, type Browser } from "@playwright/test";
import { adminClient, isRemote } from "./testUser";

// Local only. The whole leave journey through the screens, for an account of its own (it ends by
// deleting itself): someone with a trainer and a gym leaves both from Profile, still has their
// workouts and can download them, drops off the trainer's and the gym's lists, and then deletes
// their account. The trainer and the gym carry on.
const PERSON = { email: "e2e-leaver@example.test", password: "e2e-leaver-123", name: "Lina" };
const TRAINER = { email: "e2e-leave-trainer@example.test", password: "e2e-leave-trainer-123", name: "Tomas" };
const OWNER = { email: "e2e-leave-owner@example.test", password: "e2e-leave-owner-123", name: "Ola" };
const GYM = "Leave Test Gym";
const DATE = "2026-10-01";

test.skip(isRemote, "creates and deletes accounts");

// `landing` is the heading of the page they land on: their name, or a gym owner's gym.
async function signIn(browser: Browser, who: { email: string; password: string; name: string }, landing = who.name) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(who.email);
  await page.getByPlaceholder("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(landing) })).toBeVisible();
  return { context, page };
}

test("someone leaves their trainer and gym, keeps and downloads their data, then deletes their account", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = adminClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  for (const who of [PERSON, TRAINER, OWNER]) {
    const previous = list.users.find((user) => user.email === who.email);
    if (previous) await admin.auth.admin.deleteUser(previous.id);
  }

  const ids: Record<string, string> = {};
  for (const who of [PERSON, TRAINER, OWNER]) {
    const { data, error } = await admin.auth.admin.createUser({ email: who.email, password: who.password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    ids[who.email] = data.user.id;
    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: data.user.id, first_name: who.name, full_name: who.name, onboarded: true, timezone: "UTC" });
    if (profileError) throw profileError;
  }
  const personId = ids[PERSON.email];
  const trainerId = ids[TRAINER.email];
  const { data: exercise } = await admin.from("exercises").select("id").is("user_id", null).eq("name", "Barbell Bench Press").single();
  const { data: gym, error: gymError } = await admin.from("gyms").insert({ owner_id: ids[OWNER.email], name: GYM }).select("id").single();
  if (gymError || !gym || !exercise) throw gymError ?? new Error("setup failed");
  const { data: log, error: logError } = await admin.from("workout_logs").insert({ user_id: personId, date: DATE }).select("id").single();
  if (logError || !log) throw logError;
  const { data: le } = await admin.from("logged_exercises").insert({ log_id: log.id, exercise_id: exercise.id, position: 0 }).select("id").single();
  for (const [table, row] of [
    ["trainer_profiles", { user_id: trainerId, display_name: TRAINER.name }],
    ["trainer_clients", { trainer_id: trainerId, client_id: personId }],
    ["gym_members", { gym_id: gym.id, user_id: personId }],
    ["logged_sets", { logged_exercise_id: le!.id, set_number: 1, reps: 8, weight: 60 }],
  ] as const) {
    const { error } = await admin.from(table).insert(row);
    if (error) throw error;
  }

  try {
    const trainer = await signIn(browser, TRAINER);
    await trainer.page.goto("/trainer/clients");
    await expect(trainer.page.getByRole("link", { name: new RegExp(PERSON.name) })).toBeVisible();
    const owner = await signIn(browser, OWNER, GYM);
    await owner.page.goto("/gym/members");
    await expect(owner.page.getByText(PERSON.name).first()).toBeVisible();

    // The person leaves their trainer and their gym from Profile.
    const person = await signIn(browser, PERSON);
    const { page } = person;
    await page.goto("/profile");
    const trainerCard = page.locator("section").filter({ hasText: TRAINER.name }).first();
    await trainerCard.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(`${TRAINER.name} will stop seeing your plans and workouts.`)).toBeVisible();
    await trainerCard.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("heading", { name: "Your trainer" })).toHaveCount(0);

    await page.getByRole("button", { name: "Leave gym" }).click();
    await page.getByRole("button", { name: "Leave", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your gym" })).toHaveCount(0);

    // Their workout is still theirs, and they can download it.
    await page.goto("/history");
    await expect(page.getByText("Barbell Bench Press").first()).toBeVisible();
    await page.goto("/profile");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Download my data/ }).click()]);
    expect(download.suggestedFilename()).toMatch(/^gymjourno-data-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(await download.failure()).toBeNull();

    // The trainer and the gym no longer list them, and the trainer can't open their page.
    await trainer.page.goto("/trainer/clients");
    await expect(trainer.page.getByRole("link", { name: new RegExp(PERSON.name) })).toHaveCount(0);
    await trainer.page.goto(`/trainer/clients/${personId}`);
    await expect(trainer.page.getByText("Barbell Bench Press")).toHaveCount(0);
    await owner.page.goto("/gym/members");
    await expect(owner.page.getByText(PERSON.name)).toHaveCount(0);

    // They delete their account.
    await page.goto("/profile");
    await page.getByRole("button", { name: "Delete…" }).click();
    await page.getByPlaceholder("DELETE").fill("DELETE");
    await page.getByRole("button", { name: "Permanently delete" }).click();
    await expect(page).toHaveURL(/\/login/);
    const { data: after } = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(after.users.some((user) => user.id === personId)).toBe(false);
    const { count } = await admin.from("workout_logs").select("id", { count: "exact", head: true }).eq("user_id", personId);
    expect(count).toBe(0);

    // The trainer and the gym carry on.
    await trainer.page.goto("/trainer/clients");
    await expect(trainer.page.getByRole("heading", { name: /clients/i }).first()).toBeVisible();
    await owner.page.goto("/gym");
    await expect(owner.page.getByText(GYM).first()).toBeVisible();

    for (const ctx of [trainer.context, owner.context, person.context]) await ctx.close();
  } finally {
    for (const id of Object.values(ids)) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
});
