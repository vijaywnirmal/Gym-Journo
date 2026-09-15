"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validation/auth";

export type CompleteOnboardingInput = {
  fullName: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: string;
  goal: string;
  password: string;
};

export async function completeOnboarding(input: CompleteOnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const parsedPassword = passwordSchema.safeParse(input.password);
  if (!parsedPassword.success) {
    return { error: parsedPassword.error.issues[0]?.message ?? "Invalid password." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: input.password,
  });
  if (passwordError) return { error: passwordError.message };

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: input.fullName || null,
    age: input.age,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    sex: input.sex || null,
    goal: input.goal || null,
    onboarded: true,
    updated_at: new Date().toISOString(),
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");
  return { success: true };
}
