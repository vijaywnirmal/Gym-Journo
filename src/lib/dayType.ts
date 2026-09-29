// What a scheduled day is: a workout, a planned rest day, or an absence (sick, travel, injury).
// Stored as workout_plans.is_rest_day + off_kind (migration 0029). Pure.

export const DAY_TYPES = ["workout", "rest", "absence"] as const;
export type DayType = (typeof DAY_TYPES)[number];
export type OffKind = Exclude<DayType, "workout">;

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  workout: "🏋️ Workout",
  rest: "😴 Rest",
  absence: "⏸️ Absence",
};

export const DAY_TYPE_TITLE_PLACEHOLDER: Record<DayType, string> = {
  workout: "Day title (e.g. Push Day)",
  rest: "Note (optional) — e.g. Recovery, Deload",
  absence: "Reason (optional) — e.g. Sick, Travel, Injury",
};

export function isDayType(value: unknown): value is DayType {
  return typeof value === "string" && (DAY_TYPES as readonly string[]).includes(value);
}

// The day type of a saved plan. Rows saved before off_kind existed are rest days.
export function dayTypeOf(plan: { is_rest_day: boolean; off_kind?: string | null }): DayType {
  if (!plan.is_rest_day) return "workout";
  return plan.off_kind === "absence" ? "absence" : "rest";
}

// The off_kind save_workout_plan expects: null for a workout day.
export function offKindOf(dayType: DayType): OffKind | null {
  return dayType === "workout" ? null : dayType;
}
