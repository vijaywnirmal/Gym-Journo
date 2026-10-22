"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWithGemini } from "@/lib/gemini";
import { getRecentTrainingSummary, getUpcomingScheduleSummary } from "@/lib/queries";
import { startOfDayIn, todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";
import { AI_PLAN_LIMITS, buildPrompt, type AiPlanInput } from "@/lib/ai-plan-prompt";

const DAILY_LIMIT = 3;

// shareConsent: the person ticked that their details may be sent to Gemini (AI_PLAN_NOTICE), for
// this plan. Nothing is sent without it.
export type GeneratePlanInput = AiPlanInput & { shareConsent: boolean };

function inputError(input: GeneratePlanInput): string | null {
  const fields = [input.activityLevel, input.dietaryPreference, input.notes, input.mealsToday];
  if (fields.some((value) => typeof value !== "string")) return "Something went wrong. Reload the page and try again.";
  if (input.shareConsent !== true) return "Confirm that your details can be sent to Google's Gemini model.";
  if (input.activityLevel.length > 100 || input.dietaryPreference.length > 100) return "Choose an option from the list.";
  if (input.notes.length > AI_PLAN_LIMITS.notes) return `Keep your notes under ${AI_PLAN_LIMITS.notes} characters.`;
  if (input.mealsToday.length > AI_PLAN_LIMITS.mealsToday)
    return `Keep what you've eaten under ${AI_PLAN_LIMITS.mealsToday} characters.`;
  return null;
}

export async function generatePlan(input: GeneratePlanInput) {
  const invalid = inputError(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { timeZone } = await getUserTimeZone();
  const todayStr = todayIn(timeZone);
  const startOfDay = startOfDayIn(todayStr, timeZone);

  const { count } = await supabase
    .from("ai_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfDay.toISOString());

  if ((count ?? 0) >= DAILY_LIMIT) {
    return { error: `You've reached today's limit of ${DAILY_LIMIT} AI plans. Try again tomorrow.` };
  }

  const [{ data: profile }, { data: latestWeight }, trainingSummary, scheduleSummary] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "date_of_birth, height_cm, weight_kg, gender, primary_goal, target_weight_kg, experience_level, training_days_per_week"
      )
      .eq("id", user.id)
      .maybeSingle(),
    // The latest logged body weight is more current than the profile's.
    supabase
      .from("body_measurements")
      .select("weight_kg")
      .eq("user_id", user.id)
      .lte("date", todayStr)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getRecentTrainingSummary(14),
    getUpcomingScheduleSummary(7),
  ]);

  if (input.mealsToday.trim()) {
    await supabase.from("nutrition_logs").upsert(
      {
        user_id: user.id,
        date: todayStr,
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
        (profile && { ...profile, weight_kg: latestWeight?.weight_kg ?? profile.weight_kg }) ?? {
          date_of_birth: null,
          height_cm: null,
          weight_kg: null,
          gender: null,
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
    // The provider's own error text (status codes, JSON) means nothing to the person; log it here.
    console.error("AI plan generation failed:", e instanceof Error ? e.message : e);
    return { error: "Couldn't write your plan just now. Please try again in a few minutes." };
  }

  const { error: insertError } = await supabase.from("ai_plans").insert({
    user_id: user.id,
    activity_level: input.activityLevel || null,
    dietary_preference: input.dietaryPreference || null,
    notes: input.notes || null,
    plan_markdown: planMarkdown,
  });
  if (insertError) {
    console.error("Saving the AI plan failed:", insertError.message);
    return { error: "Your plan was written but couldn't be saved. Please try again." };
  }

  revalidatePath("/ai-plan");
  return { success: true, planMarkdown };
}
