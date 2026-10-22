import { calculateAge } from "@/lib/date";

export type AiPlanInput = {
  activityLevel: string;
  dietaryPreference: string;
  notes: string;
  mealsToday: string;
};

// What a plan request sends to Google's Gemini model, shown on the AI plan page before anything is
// sent. Kept next to buildPrompt so the notice and the prompt change together (ai-plan-prompt.test.ts
// checks the prompt against it). The name is deliberately not sent: the plan doesn't need it.
export const AI_PLAN_NOTICE = {
  summary: "To write your plan, these details are sent to Google's Gemini model each time you generate one:",
  shared: [
    "Your age (from your date of birth), height, weight and gender",
    "Your goal settings: goal, target weight, experience level and training days per week",
    "Your workouts from the last 14 days and your plans for the next 7",
    "What you enter here: activity level, diet, what you've eaten today and any notes",
  ],
  notShared: "Your name and email are never sent.",
  kept: "The plan is saved in your account, with your activity level, diet and notes.",
} as const;

// Upper bounds for the free-text fields, enforced in the form and again on the server.
export const AI_PLAN_LIMITS = { notes: 1000, mealsToday: 2000 } as const;

export type AiPlanProfile = {
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
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
- Age: ${age ?? "N/A"}
- Height: ${profile.height_cm ?? "N/A"} cm
- Weight: ${profile.weight_kg ?? "N/A"} kg
- Gender: ${profile.gender && profile.gender !== "prefer_not_to_say" ? profile.gender : "N/A"}
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
