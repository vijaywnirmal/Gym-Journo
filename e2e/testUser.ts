import { createClient } from "@supabase/supabase-js";

// The one account the end-to-end specs use. Recreated from scratch at the start of every run (its
// logs, plans and custom exercises go with it via ON DELETE CASCADE), so runs never depend on
// what an earlier run left behind.

export const TEST_USER = {
  email: "e2e@example.test",
  password: "e2e-password-123",
  firstName: "Robin",
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — start the local Supabase and see e2e/README.md.`);
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

// The test user's today — the profile and the browser both use UTC.
export function todayUtc(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
