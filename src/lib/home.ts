import { PRIMARY_GOAL_LABELS } from "@/lib/ai-plan-prompt";

// Goals for which a target weight is a meaningful thing to show (mirrors ProfileFields.tsx).
const TARGET_WEIGHT_GOALS = new Set(["build_muscle", "lose_fat"]);

export function getGreeting(fullName: string | null, hour: number): string {
  const firstName = fullName?.trim().split(/\s+/)[0];
  if (!firstName) return "Welcome back";
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${timeOfDay}, ${firstName}`;
}

export type GoalSummary = {
  goalLine: string;
  targetLine: string | null;
};

export function formatGoalSummary(profile: {
  primary_goal: string | null;
  training_days_per_week: number | null;
  target_weight_kg: number | null;
}): GoalSummary | null {
  if (!profile.primary_goal) return null;

  const label = PRIMARY_GOAL_LABELS[profile.primary_goal] ?? profile.primary_goal;
  const days = profile.training_days_per_week;
  const goalLine = days ? `${label} · ${days} training day${days === 1 ? "" : "s"}/week` : label;

  const showTarget = TARGET_WEIGHT_GOALS.has(profile.primary_goal) && !!profile.target_weight_kg;
  const targetLine = showTarget ? `Target: ${profile.target_weight_kg} kg` : null;

  return { goalLine, targetLine };
}

export type TrainingFrequencySummary = {
  actualLine: string;
  goalLine: string;
};

// Purely descriptive — states the stated goal and the observed count from
// getTrainingConsistency() side by side, with no judgment (no "on track"/"behind"/score) of any
// kind. Returns null when no weekly-frequency goal is set, so the section can be omitted cleanly.
export function formatTrainingFrequency(
  trainingDaysPerWeek: number | null,
  daysLogged: number,
  windowDays: number
): TrainingFrequencySummary | null {
  if (trainingDaysPerWeek === null) return null;

  return {
    actualLine: `${daysLogged} workout${daysLogged === 1 ? "" : "s"} in the last ${windowDays} days`,
    goalLine: `Goal: ${trainingDaysPerWeek} day${trainingDaysPerWeek === 1 ? "" : "s"}/week`,
  };
}

export type WorkoutCta = {
  label: string;
  href: string;
};

export function getWorkoutCta(date: string, hasLog: boolean, completed: boolean): WorkoutCta {
  if (completed) return { label: "View Log", href: `/log/${date}` };
  if (hasLog) return { label: "Continue Workout", href: `/log/${date}` };
  return { label: "Start Workout", href: `/log/${date}` };
}
