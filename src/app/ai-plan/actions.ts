"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWithGemini } from "@/lib/gemini";
import { getRecentTrainingSummary, getUpcomingScheduleSummary } from "@/lib/queries";
import { today } from "@/lib/date";
import { buildPrompt, type AiPlanInput } from "@/lib/ai-plan-prompt";

const DAILY_LIMIT = 3;

export type GeneratePlanInput = AiPlanInput;

export async function generatePlan(input: GeneratePlanInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("ai_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfDay.toISOString());

  if ((count ?? 0) >= DAILY_LIMIT) {
    return { error: `You've reached today's limit of ${DAILY_LIMIT} AI plans. Try again tomorrow.` };
  }

  const [{ data: profile }, trainingSummary, scheduleSummary] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, date_of_birth, height_cm, weight_kg, sex, primary_goal, target_weight_kg, experience_level, training_days_per_week"
      )
      .eq("id", user.id)
      .maybeSingle(),
    getRecentTrainingSummary(14),
    getUpcomingScheduleSummary(7),
  ]);

  if (input.mealsToday.trim()) {
    await supabase.from("nutrition_logs").upsert(
      {
        user_id: user.id,
        date: today(),
        meals_text: input.mealsToday.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );
  }

  let planMarkdown: string;
  try {
    planMarkdown = await generateWithGemini(
      buildPrompt(
        profile ?? {
          full_name: null,
          date_of_birth: null,
          height_cm: null,
          weight_kg: null,
          sex: null,
          primary_goal: null,
          target_weight_kg: null,
          experience_level: null,
          training_days_per_week: null,
        },
        input,
        trainingSummary,
        scheduleSummary
      )
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to generate plan." };
  }

  const { error: insertError } = await supabase.from("ai_plans").insert({
    user_id: user.id,
    activity_level: input.activityLevel || null,
    dietary_preference: input.dietaryPreference || null,
    notes: input.notes || null,
    plan_markdown: planMarkdown,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/ai-plan");
  return { success: true, planMarkdown };
}
