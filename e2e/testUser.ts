import { createClient } from "@supabase/supabase-js";

// Two ways to run the specs:
// - Locally and in CI (the default): against a local Supabase. The one test account is recreated
//   from scratch at the start of every run (its logs, plans and custom exercises go with it via
//   ON DELETE CASCADE), so runs never depend on what an earlier run left behind.
// - Against a deployed site, when E2E_BASE_URL is set (production after a deploy): the specs sign in
//   as an existing account (E2E_EMAIL, E2E_PASSWORD, E2E_FIRST_NAME), never create or delete one,
//   need no service role key, and only the specs tagged PROD_SAFE run: they only read, or remove
//   what they create. See e2e/README.md.
export const REMOTE_BASE_URL = process.env.E2E_BASE_URL || null;
export const isRemote = REMOTE_BASE_URL !== null;
export const PROD_SAFE = "@prod-safe";

// The account's time zone. The browser runs in it too, so TimezoneSync never changes the account's.
export const TEST_TIMEZONE = process.env.E2E_TIMEZONE || "UTC";

export const TEST_USER = isRemote
  ? { email: requireEnv("E2E_EMAIL"), password: requireEnv("E2E_PASSWORD"), firstName: requireEnv("E2E_FIRST_NAME") }
  : { email: "e2e@example.test", password: "e2e-password-123", firstName: "Robin" };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see e2e/README.md.`);
  return value;
}

// Admin client for the local Supabase (service role: bypasses row-level security). Test setup only.
export function adminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recreateTestUser(): Promise<string> {
  const admin = adminClient();

  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const previous = existing.users.find((user) => user.email === TEST_USER.email);
  if (previous) {
    const { error } = await admin.auth.admin.deleteUser(previous.id);
    if (error) throw error;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    first_name: TEST_USER.firstName,
    last_name: "Tester",
    full_name: `${TEST_USER.firstName} Tester`,
    onboarded: true,
    primary_goal: "build_muscle",
    experience_level: "intermediate",
    training_days_per_week: 3,
    timezone: "UTC",
  });
  if (profileError) throw profileError;
  return data.user.id;
}

// A day in the test account's time zone, as YYYY-MM-DD: today, or offsetDays from it.
export function testDate(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: TEST_TIMEZONE });
}
