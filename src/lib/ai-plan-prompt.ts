import { calculateAge } from "@/lib/date";

export type AiPlanInput = {
  activityLevel: string;
  dietaryPreference: string;
  notes: string;
  mealsToday: string;
};

export type AiPlanProfile = {
  full_name: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  sex: string | null;
  primary_goal: string | null;
  target_weight_kg: number | null;
  experience_level: string | null;
  training_days_per_week: number | null;
};

export const PRIMARY_GOAL_LABELS: Record<string, string> = {
  build_muscle: "Build muscle",
  lose_fat: "Lose fat",
  maintain: "Maintain",
  general_fitness: "General fitness",
};

export function buildPrompt(
  profile: AiPlanProfile,
  input: AiPlanInput,
  trainingSummary: string,
  scheduleSummary: string
) {
  const age = profile.date_of_birth ? calculateAge(profile.date_of_birth) : null;
  const goalLabel = profile.primary_goal
    ? (PRIMARY_GOAL_LABELS[profile.primary_goal] ?? profile.primary_goal)
    : "General fitness";
  return `You are a certified fitness coach and nutritionist. Create a personalized diet and workout recommendation for this person, using everything you know about their recent behavior.

## Profile
- Name: ${profile.full_name ?? "N/A"}
- Age: ${age ?? "N/A"}
- Height: ${profile.height_cm ?? "N/A"} cm
- Weight: ${profile.weight_kg ?? "N/A"} kg
- Sex: ${profile.sex ?? "N/A"}
- Goal: ${goalLabel}${profile.target_weight_kg ? ` (target weight: ${profile.target_weight_kg} kg)` : ""}
- Experience level: ${profile.experience_level ?? "N/A"}
- Training days per week: ${profile.training_days_per_week ?? "N/A"}
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
