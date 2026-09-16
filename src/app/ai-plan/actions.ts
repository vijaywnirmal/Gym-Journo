"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWithGemini } from "@/lib/gemini";
import { getRecentTrainingSummary, getUpcomingScheduleSummary } from "@/lib/queries";
import { calculateAge, today } from "@/lib/date";

const DAILY_LIMIT = 3;

export type GeneratePlanInput = {
  activityLevel: string;
  dietaryPreference: string;
  notes: string;
  mealsToday: string;
};

function buildPrompt(
  profile: {
    full_name: string | null;
    date_of_birth: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    sex: string | null;
    goal: string | null;
  },
  input: GeneratePlanInput,
  trainingSummary: string,
  scheduleSummary: string
) {
  const age = profile.date_of_birth ? calculateAge(profile.date_of_birth) : null;
  return `You are a certified fitness coach and nutritionist. Create a personalized diet and workout recommendation for this person, using everything you know about their recent behavior.

## Profile
- Name: ${profile.full_name ?? "N/A"}
- Age: ${age ?? "N/A"}
- Height: ${profile.height_cm ?? "N/A"} cm
- Weight: ${profile.weight_kg ?? "N/A"} kg
- Sex: ${profile.sex ?? "N/A"}
- Goal: ${profile.goal ?? "General fitness"}
- Activity level: ${input.activityLevel || "Not specified"}
- Dietary preference: ${input.dietaryPreference || "No restrictions"}
- Additional notes: ${input.notes || "None"}

## Training history (last 14 days, from their logged workouts)
${trainingSummary}

## Upcoming schedule (next 7 days, already planned)
${scheduleSummary}

## What they've eaten today (self-reported, estimate calories/macros yourself from this)
${input.mealsToday || "Nothing logged yet today."}

Based on ALL of the above — not just the profile — write a response in markdown with exactly three top-level sections:

## Assessment
2-3 sentences on their training consistency, any muscle groups being neglected based on the history above, and whether today's food intake so far is on track for their goal.

## Diet Plan
A plan for the REST of today (accounting for what they've already eaten) plus general daily targets (calories, protein) going forward. Keep portions approximate.

## Workout Plan
A 7-day workout plan that complements their existing upcoming schedule (don't just repeat what's already planned — fill gaps, fix imbalances, respect their rest days) with exercises, sets, and reps.

Keep it concise and practical. Add a brief disclaimer at the end that this is AI-generated and not a substitute for professional medical or dietary advice.`;
}

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
      .select("full_name, date_of_birth, height_cm, weight_kg, sex, goal")
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
          goal: null,
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
