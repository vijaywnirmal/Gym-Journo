import { expect, test, type Browser } from "@playwright/test";
import { adminClient, isRemote, TEST_USER } from "./testUser";

// Local only: it creates a gym owner and a trainer, the test user joins the gym as a member, the gym
// suggests the trainer, whom the member accepts, and both record a fee. Both accounts are removed at
// the end (the gym, the member's link with the trainer and the fees go with them).
const OWNER = { email: "e2e-gym-owner@example.test", password: "e2e-gym-owner-123", name: "Vikram" };
const TRAINER = { email: "e2e-gym-trainer@example.test", password: "e2e-gym-trainer-123", name: "Asha" };
const GYM = "E2E Gym";

test.skip(isRemote, "creates gym accounts");

async function signIn(browser: Browser, who: { email: string; password: string; name: string }) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(who.email);
  await page.getByPlaceholder("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(who.name) })).toBeVisible();
  return { context, page };
}

test("a gym invites a trainer and a member, suggests the trainer, the member accepts, and both record fees", async ({ page, browser }) => {
  const admin = adminClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  for (const who of [OWNER, TRAINER]) {
    const previous = list.users.find((user) => user.email === who.email);
    if (previous) await admin.auth.admin.deleteUser(previous.id);
  }

  const ids: string[] = [];
  for (const who of [OWNER, TRAINER]) {
    const { data, error } = await admin.auth.admin.createUser({ email: who.email, password: who.password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    ids.push(data.user.id);
    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: data.user.id, first_name: who.name, full_name: who.name, onboarded: true, timezone: "UTC" });
    if (profileError) throw profileError;
  }
  const [ownerId, trainerId] = ids;
  const { error: trainerError } = await admin.from("trainer_profiles").insert({ user_id: trainerId, display_name: TRAINER.name });
  if (trainerError) throw trainerError;

  const liveCode = async (role: "member" | "trainer") => {
    const { data: gym, error: gymError } = await admin.from("gyms").select("id").eq("owner_id", ownerId).single();
    if (gymError) throw gymError;
    const { data, error } = await admin
      .from("gym_invites")
      .select("code")
      .eq("gym_id", gym.id)
      .eq("role", role)
      .is("revoked_at", null)
      .single();
    if (error) throw error;
    return data.code as string;
  };

  try {
    // The owner sets up the gym and makes a member link and a trainer link.
    const owner = await signIn(browser, OWNER);
    await owner.page.goto("/gym/setup");
    await owner.page.getByLabel("Gym name").fill(GYM);
    await owner.page.getByLabel("City").fill("Pune");
    await owner.page.getByRole("button", { name: "Continue" }).click();
    await expect(owner.page.getByRole("heading", { name: "Invite people" })).toBeVisible();
    await owner.page.getByRole("button", { name: "Make an invite link" }).first().click();
    await expect(owner.page.getByRole("link", { name: "Print poster" })).toBeVisible();
    await owner.page.getByRole("button", { name: "Make an invite link" }).first().click();
    // Wait for the trainer link itself: while it's being made the button reads "Making a link…",
    // so counting "Make an invite link" buttons can pass before the link is saved.
    await expect(owner.page.getByRole("button", { name: "Make a new link" })).toHaveCount(2);
    await expect(owner.page.getByRole("button", { name: "Make an invite link" })).toHaveCount(1);
    const memberCode = await liveCode("member");
    const trainerCode = await liveCode("trainer");
    // Running a gym makes it a work account: the journal's pages lead to the gym's dashboard.
    await owner.page.goto("/calendar");
    await expect(owner.page).toHaveURL(/\/gym$/);

    // The trainer joins.
    const trainer = await signIn(browser, TRAINER);
    await trainer.page.goto(`/g/${trainerCode}?role=trainer`);
    await expect(trainer.page.getByRole("heading", { name: `Train at ${GYM}` })).toBeVisible();
    await trainer.page.getByRole("button", { name: `Join ${GYM}` }).click();
    await expect(trainer.page).toHaveURL(/\/trainer$/);
    await expect(trainer.page.getByRole("navigation", { name: "Primary" }).first()).toContainText("Plans");

    // The test user joins as a member, after seeing what the gym will see.
    await page.goto(`/g/${memberCode}`);
    await expect(page.getByRole("heading", { name: `Join ${GYM}` })).toBeVisible();
    await expect(page.getByText(`${GYM} won't see`)).toBeVisible();
    await page.getByRole("button", { name: `Join ${GYM}` }).click();
    await expect(page.getByRole("heading", { name: "Your gym" })).toBeVisible();

    // The owner suggests the trainer.
    await owner.page.goto("/gym/members?filter=needs-trainer");
    await owner.page.getByRole("link", { name: new RegExp(TEST_USER.firstName) }).click();
    await owner.page.getByRole("button", { name: `Suggest ${TRAINER.name}` }).click();
    await expect(owner.page.getByRole("status")).toContainText(`Suggested ${TRAINER.name}.`);

    // Nothing is shared until the member accepts.
    await trainer.page.goto("/trainer/clients");
    await expect(trainer.page.getByText("No clients yet")).toBeVisible();

    // The member sees the suggestion on Today and accepts it on Profile.
    await page.goto("/");
    await page.getByRole("link", { name: new RegExp(`${GYM} suggests ${TRAINER.name}`) }).click();
    await expect(page.getByText(`${TRAINER.name} will see`)).toBeVisible();
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByRole("heading", { name: "Your trainer" })).toBeVisible();
    await expect(page.getByText(TRAINER.name, { exact: true })).toBeVisible();

    await trainer.page.goto("/trainer/clients");
    await expect(trainer.page.getByRole("link", { name: new RegExp(TEST_USER.firstName) })).toBeVisible();
    await owner.page.goto("/gym/members");
    await expect(owner.page.getByRole("link", { name: new RegExp(TEST_USER.firstName) })).toContainText(TRAINER.name);

    // The gym and the trainer each record a fee; the member sees both on Profile.
    await owner.page.getByRole("link", { name: new RegExp(TEST_USER.firstName) }).click();
    // A slow phone connection, where the refreshed page arrives after the action's result: the
    // card's message must still show with the saved fee, not next to the old one.
    const cdp = await owner.context.newCDPSession(owner.page);
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 20000, uploadThroughput: 20000 });
    await owner.page.getByRole("button", { name: "Set fee" }).click();
    await owner.page.getByLabel("Amount (₹)").fill("1500");
    await owner.page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(owner.page.getByText("Fee set.")).toBeVisible();
    expect(await owner.page.getByText("No fee set").count()).toBe(0);
    await expect(owner.page.getByText("Due today")).toBeVisible();
    await owner.page.getByRole("button", { name: "Record payment" }).click();
    await owner.page.getByRole("button", { name: "Record", exact: true }).click();
    await expect(owner.page.getByText(/^Payment recorded\. Paid until/)).toBeVisible();
    expect(await owner.page.getByText("Due today").count()).toBe(0);
    await owner.page.goto("/gym");
    await expect(owner.page.getByRole("link", { name: /Collected/ })).toContainText("₹1,500");

    await trainer.page.getByRole("link", { name: new RegExp(TEST_USER.firstName) }).click();
    await trainer.page.getByRole("button", { name: "Set fee" }).click();
    await trainer.page.getByLabel("Amount (₹)").fill("4000");
    await trainer.page.getByLabel("Every").selectOption("3");
    await trainer.page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(trainer.page.getByText("Fee set.")).toBeVisible();
    expect(await trainer.page.getByText("No fee set").count()).toBe(0);
    await trainer.page.goto("/trainer");
    await expect(trainer.page.getByRole("heading", { name: "Fees due" })).toBeVisible();
    await expect(trainer.page.getByRole("link", { name: new RegExp(TEST_USER.firstName) }).last()).toContainText("Due today");

    await page.goto("/profile");
    await expect(page.getByText("Fee: ₹1,500 a month")).toBeVisible();
    await expect(page.getByText(/^Paid ₹1,500 on/)).toBeVisible();
    await expect(page.getByText("Fee: ₹4,000 every 3 months")).toBeVisible();

    await owner.context.close();
    await trainer.context.close();
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
});
